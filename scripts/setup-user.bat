@echo off
:: Thin launcher for the Windows self-hosting setup. All logic lives in
:: setup-user.ps1 (a mirror of setup-user.sh) so the two stay in sync.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-user.ps1" %*
exit /b %ERRORLEVEL%
