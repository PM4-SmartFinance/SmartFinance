@echo off
:: Thin launcher for stopping the Windows self-hosting stack. All logic lives in
:: stop-user.ps1 (a mirror of stop-user.sh) so the two stay in sync.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-user.ps1" %*
exit /b %ERRORLEVEL%
