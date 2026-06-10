# First-time install for the SmartFinance self-hosted stack on Windows.
# PowerShell mirror of scripts/setup-user.sh. Invoked by scripts\setup-user.bat.
#
# This brings the stack up (delegated to scripts/start-user.ps1, which pulls or
# builds images, migrates the database, and starts the containers) and then
# seeds a single default administrator on the fresh database.
#
# Run this ONCE, on a brand new database. On every subsequent start -- after a
# reboot, or after stopping the stack -- use scripts\start-user.bat instead.
# Re-running setup against a database that already has users would fail: the
# first-user bootstrap endpoint returns 401 once an administrator exists, and we
# deliberately do not re-inject a default user over a configured installation.
#
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

Write-Host '===================================================='
Write-Host '      Setting up SmartFinance Production Stack      '
Write-Host '===================================================='
Write-Host ''

# Documented default admin credentials so first-time self-hosters know the login.
$adminEmail = $env:BOOTSTRAP_EMAIL
if ([string]::IsNullOrWhiteSpace($adminEmail)) { $adminEmail = 'admin@smartfinance.local' }
$adminPassword = $env:BOOTSTRAP_PASSWORD
if ([string]::IsNullOrWhiteSpace($adminPassword)) { $adminPassword = 'changeme123' }

# Bring the whole stack up. start-user.ps1 owns dependency checks, image
# resolution, .env secrets, migrations, and container startup; SMARTFINANCE_QUIET
# suppresses its standalone banner so we can print a single first-time banner.
# start-user.ps1 calls `exit` on any real failure, which terminates this process
# too -- so reaching the lines below means the stack came up successfully.
$env:SMARTFINANCE_QUIET = '1'
try {
    & (Join-Path $ScriptDir 'start-user.ps1')
} finally {
    Remove-Item Env:\SMARTFINANCE_QUIET -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'Seeding default administrative credentials (waiting for backend to boot)...'
$bootstrap = Join-Path $ScriptDir 'bootstrap-admin.mjs'
Get-Content -Raw $bootstrap | & docker compose -f $ComposeFile exec -T `
    -e "BOOTSTRAP_EMAIL=$adminEmail" `
    -e "BOOTSTRAP_PASSWORD=$adminPassword" `
    backend node --input-type=module
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Seeding the default administrator failed.'
    Write-Host 'If this database already has users, do not run setup again -- use scripts\start-user.bat to resume.'
    exit 1
}

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
Write-Host ''
Write-Host ' To start the stack again later (without re-seeding), run:'
Write-Host '   scripts\start-user.bat'
Write-Host ' To stop the stack, run:'
Write-Host '   scripts\stop-user.bat'
Write-Host '===================================================='
