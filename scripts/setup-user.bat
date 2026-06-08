@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "COMPOSE_FILE=docker-compose.user.yml"

pushd "%SCRIPT_DIR%.." || (echo Error: cannot enter project root.& exit /b 1)

echo ====================================================
echo       Setting up SmartFinance Production Stack
echo ====================================================
echo.

where docker >nul 2>&1 || (echo Error: Docker is not installed or not on PATH.& goto :fail)
docker compose version >nul 2>&1 || (echo Error: Docker Compose plugin is required.& goto :fail)
docker info >nul 2>&1 || (echo Error: Docker daemon is not running. Start Docker Desktop and retry.& goto :fail)

echo Preparing environment and administrator credentials...
set "ADMIN_EMAIL="
set "ADMIN_PASSWORD="
for /f "usebackq tokens=1-2 delims=|" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-user-env.ps1"`) do (
  set "ADMIN_EMAIL=%%a"
  set "ADMIN_PASSWORD=%%b"
)
if "%ADMIN_PASSWORD%"=="" (echo Error: failed to prepare environment ^(could not generate secrets^).& goto :fail)

echo.
echo Pulling images (best-effort)...
docker compose -f %COMPOSE_FILE% pull

echo Starting core infrastructure (backend scaled to 0 for migrations)...
docker compose -f %COMPOSE_FILE% up -d --remove-orphans --scale backend=0 || goto :fail

echo Running production database migrations...
docker compose -f %COMPOSE_FILE% run --rm --entrypoint /bin/sh backend -c "node_modules/.bin/prisma migrate deploy" || goto :fail

echo Starting application stack...
docker compose -f %COMPOSE_FILE% up -d --remove-orphans || goto :fail

echo Seeding default administrative credentials (waiting for backend to boot)...
docker compose -f %COMPOSE_FILE% exec -T -e BOOTSTRAP_EMAIL=%ADMIN_EMAIL% -e BOOTSTRAP_PASSWORD=%ADMIN_PASSWORD% backend node --input-type=module < "%SCRIPT_DIR%bootstrap-admin.mjs" || goto :fail

echo.
echo ====================================================
echo  Setup Complete!
echo  Access your interface at: http://localhost:3000
echo.
echo  Log in with the default administrator credentials:
echo    Email:    %ADMIN_EMAIL%
echo    Password: %ADMIN_PASSWORD%
echo.
echo  IMPORTANT: This is a well-known default password. Change it
echo  IMMEDIATELY after your first login (Settings ^> Profile).
echo ====================================================

popd
endlocal
exit /b 0

:fail
echo.
echo SmartFinance setup failed. Ensure Docker Desktop is installed and running, then re-run.
popd
endlocal
exit /b 1
