@echo off
:: Thin launcher for resuming the Windows self-hosting stack. All logic lives in
:: start-user.ps1 (a mirror of start-user.sh) so the two stay in sync.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-user.ps1" %*
exit /b %ERRORLEVEL%
