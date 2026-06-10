# Stops the SmartFinance self-hosted stack on Windows. PowerShell mirror of
# scripts/stop-user.sh. Invoked by scripts\stop-user.bat.
#
# This stops and removes every container in the stack (including any leftover
# one-off migration containers) but PRESERVES the Postgres data volume, so the
# stack can be resumed later with scripts\start-user.bat without data loss.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir '..')).Path
Set-Location $ProjectRoot

$ComposeFile = 'docker-compose.user.yml'

if ($null -eq (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host 'Docker is not installed or not on PATH.'
    exit 1
}

Write-Host 'Stopping SmartFinance user stack and removing orphaned containers...'
# `down --remove-orphans` stops and removes all project containers (services plus
# any stray one-off run containers) while keeping the named data volume intact.
& docker compose -f $ComposeFile down --remove-orphans
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Optional: reclaim builder cache and dangling images older than 24 hours.'
$answer = Read-Host 'Perform cleanup now? [y/N]'
if ($answer -match '^[Yy]$') {
    & docker builder prune -f --filter 'until=24h' | Out-Null
    & docker image prune -f --filter 'until=24h' | Out-Null
    Write-Host 'Cleanup complete.'
} else {
    Write-Host 'Skipped cleanup.'
}
