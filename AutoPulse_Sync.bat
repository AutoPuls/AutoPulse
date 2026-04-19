@echo off
echo ====================================================
echo    AutoPulse: Client Site Manual Sync
echo ====================================================
echo.
echo This will update your customer's site with the latest 
echo car listings using your local (unblocked) connection.
echo.
echo [1] Checking connection...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH.
    pause
    exit /b
)

echo [2] Starting Scraper Sync...
npm run agency-sweep

echo.
echo Sync Complete! You can close this window.
pause
