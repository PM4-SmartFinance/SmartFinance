# SmartFinance self-hosting setup for Windows. PowerShell mirror of
# scripts/setup-user.sh: resolves the published image tag, generates .env secrets,
# pulls (or builds) images, migrates before serving traffic, and bootstraps the
# default administrator. Invoked by scripts\setup-user.bat.
#
# Set SMARTFINANCE_BUILD_LOCAL=1 to build images from source instead of pulling.
# Override BOOTSTRAP_EMAIL / BOOTSTRAP_PASSWORD for a non-default admin credential.

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

function Stop-Setup([string]$Message) {
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

Write-Host '===================================================='
Write-Host '      Setting up SmartFinance Production Stack      '
Write-Host '===================================================='
Write-Host ''

if (-not (Test-Command docker)) { Stop-Setup 'Missing required command: docker' }
if (-not (Test-DockerQuiet @('compose', 'version'))) { Stop-Setup 'Docker Compose plugin is required.' }
if (-not (Test-DockerQuiet @('info'))) { Stop-Setup 'Docker daemon is not running.' }

$ImageTag = Get-ImageTag
Write-Host "Target deployment version tag: $ImageTag"
Write-Host "Using published image tag: $ImageTag"

$BackendImage = "${BackendRepo}:$ImageTag"
$FrontendImage = "${FrontendRepo}:$ImageTag"
$RemoteAvailable = Test-RemoteImage $ImageTag

$BuildLocal = $env:SMARTFINANCE_BUILD_LOCAL
$UseLocalBuild = ($BuildLocal -eq '1' -or $BuildLocal -eq 'true')

# Generate secrets only when missing; never ship a static fallback.
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

# Documented default admin credentials so first-time self-hosters know the login.
$adminEmail = $env:BOOTSTRAP_EMAIL
if ([string]::IsNullOrWhiteSpace($adminEmail)) { $adminEmail = 'admin@smartfinance.local' }
$adminPassword = $env:BOOTSTRAP_PASSWORD
if ([string]::IsNullOrWhiteSpace($adminPassword)) { $adminPassword = 'changeme123' }

Write-Host ''
if ($UseLocalBuild) {
    Write-Host 'Building images from source (SMARTFINANCE_BUILD_LOCAL set); skipping pull.'
} else {
    Write-Host 'Checking for newer images on GHCR (pull is best-effort)...'
    & docker compose -f $ComposeFile pull
    if ($LASTEXITCODE -ne 0) {
        if ($RemoteAvailable) {
            Stop-Setup "Image pull failed even though upstream images exist for tag '$ImageTag' (registry auth, network, or disk?)."
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
    if ($LASTEXITCODE -ne 0) { Stop-Setup 'Image build failed.' }
}

Write-Host 'Starting core infrastructure containers...'
& docker compose -f $ComposeFile up -d --remove-orphans --scale backend=0
if ($LASTEXITCODE -ne 0) { Stop-Setup 'Failed to start core infrastructure (is the database healthy?).' }

Write-Host 'Running production database migrations...'
& docker compose -f $ComposeFile run --rm --entrypoint /bin/sh backend -c 'node_modules/.bin/prisma migrate deploy'
if ($LASTEXITCODE -ne 0) { Stop-Setup 'Database migration failed.' }

Write-Host 'Starting application stack...'
& docker compose -f $ComposeFile up -d --remove-orphans --no-build
if ($LASTEXITCODE -ne 0) { Stop-Setup 'Failed to start the application stack.' }

Write-Host 'Seeding default administrative credentials (waiting for backend to boot)...'
$bootstrap = Join-Path $ScriptDir 'bootstrap-admin.mjs'
Get-Content -Raw $bootstrap | & docker compose -f $ComposeFile exec -T `
    -e "BOOTSTRAP_EMAIL=$adminEmail" `
    -e "BOOTSTRAP_PASSWORD=$adminPassword" `
    backend node --input-type=module
if ($LASTEXITCODE -ne 0) { Stop-Setup 'Seeding the default administrator failed.' }

Write-Host ''
Write-Host '===================================================='
Write-Host ' Setup Complete!'
Write-Host ' Access your interface at: http://localhost:3000'
Write-Host ''
Write-Host ' Log in with the default administrator credentials:'
Write-Host "   Email:    $adminEmail"
Write-Host "   Password: $adminPassword"
Write-Host ''
Write-Host ' IMPORTANT: This is a well-known default password. Change it'
Write-Host ' IMMEDIATELY after your first login (Settings > Profile).'
Write-Host '===================================================='
Write-Host ''
Write-Host 'To stop the running containers, run:'
Write-Host "  docker compose -f $ComposeFile down"
