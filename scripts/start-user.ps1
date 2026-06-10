# Brings the SmartFinance self-hosted stack up on Windows and resumes where the
# operator left off, WITHOUT seeding any administrator. PowerShell mirror of
# scripts/start-user.sh. Use this every time after the very first install: it
# pulls (or builds) the images, applies any pending database migrations, and
# starts the containers against the existing Postgres volume, so accounts and
# data created earlier are preserved. Invoked by scripts\start-user.bat.
#
# The first-time install lives in scripts/setup-user.ps1, which delegates the
# whole bring-up to THIS script and then seeds the default administrator once.
# Re-running setup against a database that already has users would fail (the
# first-user bootstrap endpoint returns 401 once an admin exists) -- that is
# exactly why resuming is a separate, idempotent script.
#
# Set SMARTFINANCE_BUILD_LOCAL=1 to build images from source instead of pulling.
# Set SMARTFINANCE_QUIET=1 (done by setup-user.ps1) to suppress the final banner.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
# Pipe bytes to container stdin as UTF-8 without BOM (bootstrap-admin.mjs is ASCII).
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir '..')).Path
Set-Location $ProjectRoot

$ComposeFile = 'docker-compose.user.yml'
$EnvPath = Join-Path $ProjectRoot '.env'
$BackendRepo = 'ghcr.io/pm4-smartfinance/smartfinance/backend'
$FrontendRepo = 'ghcr.io/pm4-smartfinance/smartfinance/frontend'
$Quiet = ($env:SMARTFINANCE_QUIET -eq '1')

function Stop-Start([string]$Message) {
    Write-Host ''
    Write-Host $Message
    Write-Host 'SmartFinance could not start. Ensure Docker Desktop is installed and running, then re-run.'
    Write-Host 'Docs: https://github.com/PM4-SmartFinance/SmartFinance/wiki'
    exit 1
}

function Test-Command([string]$Name) {
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-DockerQuiet([string[]]$DockerArgs) {
    # Runs docker silently; returns $true when it exits 0.
    & docker @DockerArgs *> $null
    return ($LASTEXITCODE -eq 0)
}

function New-HexSecret([int]$Bytes) {
    $buf = New-Object 'System.Byte[]' $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    ($buf | ForEach-Object { $_.ToString('x2') }) -join ''
}

function Get-EnvValue([string]$Key) {
    if (-not (Test-Path $EnvPath)) { return $null }
    $pattern = '^' + [regex]::Escape($Key) + '='
    $line = Get-Content $EnvPath | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if ($null -eq $line) { return $null }
    return ($line -replace $pattern, '')
}

function Set-EnvValue([string]$Key, [string]$Value) {
    if (-not (Test-Path $EnvPath)) { New-Item -ItemType File -Path $EnvPath | Out-Null }
    $content = @(Get-Content $EnvPath -ErrorAction SilentlyContinue)
    $pattern = '^' + [regex]::Escape($Key) + '='
    if ($content -match $pattern) {
        $content = $content -replace ($pattern + '.*'), ($Key + '=' + $Value)
    } else {
        $content += ($Key + '=' + $Value)
    }
    Set-Content -Path $EnvPath -Value $content
}

function Test-RemoteImage([string]$Tag) {
    (Test-DockerQuiet @('manifest', 'inspect', "${BackendRepo}:$Tag")) -and
    (Test-DockerQuiet @('manifest', 'inspect', "${FrontendRepo}:$Tag"))
}

function Get-ImageTag {
    $candidates = New-Object System.Collections.Generic.List[string]
    if ((Test-Command git) -and (Test-Path (Join-Path $ProjectRoot '.git'))) {
        $latest = (& git describe --tags --abbrev=0 --match 'v*' 2>$null)
        if ($LASTEXITCODE -eq 0 -and $latest) { $candidates.Add($latest.Trim()) }
        $tags = (& git tag --sort=-v:refname --list 'v*' 2>$null)
        if ($LASTEXITCODE -eq 0 -and $tags) {
            foreach ($t in $tags) {
                $t = $t.Trim()
                if ($t -and -not $candidates.Contains($t)) { $candidates.Add($t) }
            }
        }
    }
    $candidates.Add('latest')
    foreach ($c in $candidates) {
        $normalized = $c -replace '^[vV]', ''
        if (Test-RemoteImage $normalized) { return $normalized }
    }
    return 'latest'
}

if (-not $Quiet) {
    Write-Host '===================================================='
    Write-Host '        Starting SmartFinance Stack                 '
    Write-Host '===================================================='
    Write-Host ''
}

if (-not (Test-Command docker)) { Stop-Start 'Missing required command: docker' }
if (-not (Test-DockerQuiet @('compose', 'version'))) { Stop-Start 'Docker Compose plugin is required.' }
if (-not (Test-DockerQuiet @('info'))) { Stop-Start 'Docker daemon is not running.' }

$ImageTag = Get-ImageTag
Write-Host "Target deployment version tag: $ImageTag"
Write-Host "Using published image tag: $ImageTag"

$BackendImage = "${BackendRepo}:$ImageTag"
$FrontendImage = "${FrontendRepo}:$ImageTag"
$RemoteAvailable = Test-RemoteImage $ImageTag

$BuildLocal = $env:SMARTFINANCE_BUILD_LOCAL
$UseLocalBuild = ($BuildLocal -eq '1' -or $BuildLocal -eq 'true')

# Reuse the secrets already written to .env so an existing Postgres volume keeps
# the same password and active login sessions survive a restart. Only generate
# fresh secrets when none exist yet (i.e. the very first start).
$sessionSecret = Get-EnvValue 'SESSION_SECRET'
if ([string]::IsNullOrWhiteSpace($sessionSecret)) { $sessionSecret = New-HexSecret 32 }
$postgresPassword = Get-EnvValue 'POSTGRES_PASSWORD'
if ([string]::IsNullOrWhiteSpace($postgresPassword)) { $postgresPassword = New-HexSecret 16 }

Set-EnvValue 'SESSION_SECRET' $sessionSecret
Set-EnvValue 'POSTGRES_PASSWORD' $postgresPassword
Set-EnvValue 'IMAGE_TAG' $ImageTag

$env:SESSION_SECRET = $sessionSecret
$env:POSTGRES_PASSWORD = $postgresPassword
$env:IMAGE_TAG = $ImageTag

Write-Host ''
if ($UseLocalBuild) {
    Write-Host 'Building images from source (SMARTFINANCE_BUILD_LOCAL set); skipping pull.'
} else {
    Write-Host 'Checking for newer images on GHCR (pull is best-effort)...'
    & docker compose -f $ComposeFile pull
    if ($LASTEXITCODE -ne 0) {
        if ($RemoteAvailable) {
            Stop-Start "Image pull failed even though upstream images exist for tag '$ImageTag' (registry auth, network, or disk?)."
        }
        Write-Host "No published images for tag '$ImageTag'; will build locally."
    }
    if (-not ((Test-DockerQuiet @('image', 'inspect', $BackendImage)) -and (Test-DockerQuiet @('image', 'inspect', $FrontendImage)))) {
        $UseLocalBuild = $true
    }
}

if ($UseLocalBuild) {
    Write-Host 'Building images from source (this can take several minutes)...'
    & docker compose -f $ComposeFile build
    if ($LASTEXITCODE -ne 0) { Stop-Start 'Image build failed.' }
}

Write-Host 'Starting core infrastructure containers...'
& docker compose -f $ComposeFile up -d --remove-orphans --scale backend=0
if ($LASTEXITCODE -ne 0) { Stop-Start 'Failed to start core infrastructure (is the database healthy?).' }

Write-Host 'Running database migrations (no-op when already up to date)...'
& docker compose -f $ComposeFile run --rm --entrypoint /bin/sh backend -c 'node_modules/.bin/prisma migrate deploy'
if ($LASTEXITCODE -ne 0) { Stop-Start 'Database migration failed.' }

Write-Host 'Starting application stack...'
& docker compose -f $ComposeFile up -d --remove-orphans --no-build
if ($LASTEXITCODE -ne 0) { Stop-Start 'Failed to start the application stack.' }

# Lightweight, non-destructive cleanup of builder cache and dangling images.
Test-DockerQuiet @('builder', 'prune', '-f', '--filter', 'until=24h') | Out-Null
Test-DockerQuiet @('image', 'prune', '-f', '--filter', 'until=24h') | Out-Null

if (-not $Quiet) {
    Write-Host ''
    Write-Host '===================================================='
    Write-Host ' SmartFinance is running.'
    Write-Host ' Access your interface at: http://localhost:3000'
    Write-Host ''
    Write-Host ' Log in with your existing credentials.'
    Write-Host ' (First time? Run scripts\setup-user.bat instead to create the admin.)'
    Write-Host ''
    Write-Host ' To stop the stack, run:'
    Write-Host '   scripts\stop-user.bat'
    Write-Host '===================================================='
}
