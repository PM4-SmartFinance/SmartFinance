@echo off
setlocal

echo Setting up SmartFinance for Self-Hosting...

:: 1. Handle .env creation and Secret Generation
if not exist .env (
    echo Creating .env from template...
    copy .env.example .env
    
    echo Generating secure SESSION_SECRET...
    :: Generates a 64-character hex string using two GUIDs via PowerShell
    for /f "tokens=*" %%a in ('powershell -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set SECRET=%%a
    
    :: Use PowerShell to perform the text replacement in the file
    powershell -Command "(get-content .env) -replace 'SESSION_SECRET=.*', 'SESSION_SECRET=%SECRET%' | set-content .env"
    echo Generated secure SESSION_SECRET in .env
) else (
    echo .env already exists. Skipping environment configuration.
)

:: 2. Start Infrastructure
echo Starting Docker stack...
:: Pulls images and starts containers in detached mode
docker compose up -d

:: 3. Final Verification
echo Setup complete. 
echo Access the application at http://localhost
echo If you encounter port conflicts, please refer to the Troubleshooting section in the README.

pause
endlocal