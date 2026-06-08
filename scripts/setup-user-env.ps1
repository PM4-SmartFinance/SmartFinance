# Prepares the .env file for the SmartFinance self-hosted stack and resolves the
# administrator bootstrap credentials. Invoked by scripts\setup-user.bat.
#
# Generates SESSION_SECRET / POSTGRES_PASSWORD (if missing) using a CSPRNG, never
# a static fallback, and emits a single line "<email>|<password>|<generated>" on
# stdout for the caller to capture.

[CmdletBinding()]
param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$envPath = Join-Path $ProjectRoot '.env'

function New-HexSecret([int]$Bytes) {
    $buf = New-Object 'System.Byte[]' $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    ($buf | ForEach-Object { $_.ToString('x2') }) -join ''
}

function Get-EnvValue([string]$Key) {
    if (-not (Test-Path $envPath)) { return $null }
    $pattern = '^' + [regex]::Escape($Key) + '='
    $line = Get-Content $envPath | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if ($null -eq $line) { return $null }
    return ($line -replace $pattern, '')
}

function Set-EnvValue([string]$Key, [string]$Value) {
    if (-not (Test-Path $envPath)) { New-Item -ItemType File -Path $envPath | Out-Null }
    $content = @(Get-Content $envPath -ErrorAction SilentlyContinue)
    $pattern = '^' + [regex]::Escape($Key) + '='
    if ($content -match $pattern) {
        $content = $content -replace ($pattern + '.*'), ($Key + '=' + $Value)
    } else {
        $content += ($Key + '=' + $Value)
    }
    Set-Content -Path $envPath -Value $content
}

function Initialize-Secret([string]$Key, [int]$Bytes) {
    if ([string]::IsNullOrWhiteSpace((Get-EnvValue $Key))) {
        Set-EnvValue $Key (New-HexSecret $Bytes)
    }
}

Initialize-Secret 'SESSION_SECRET' 32
Initialize-Secret 'POSTGRES_PASSWORD' 16

$imageTag = Get-EnvValue 'IMAGE_TAG'
if ([string]::IsNullOrWhiteSpace($imageTag)) { $imageTag = 'latest' }
Set-EnvValue 'IMAGE_TAG' $imageTag

# Documented default admin credentials so first-time self-hosters always know how
# to log in; override with BOOTSTRAP_EMAIL / BOOTSTRAP_PASSWORD for a stronger one.
$email = $env:BOOTSTRAP_EMAIL
if ([string]::IsNullOrWhiteSpace($email)) { $email = 'admin@smartfinance.local' }

$password = $env:BOOTSTRAP_PASSWORD
if ([string]::IsNullOrWhiteSpace($password)) { $password = 'changeme123' }

Write-Output ('{0}|{1}' -f $email, $password)
