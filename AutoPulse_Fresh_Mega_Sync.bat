@echo off
cd /d "%~dp0"

echo ====================================================
echo    AutoPulse: High-Speed US Fresh Sync
echo ====================================================
echo.
echo Database has been wiped. This will start scraping
echo all 351 cities at high-speed (prioritizing new cars).
echo.
echo [1] Checking environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    pause
    exit /b
)

echo [2] Launching Engine (High Speed mode enabled)...
npm run agency-sweep

echo.
echo Sync Complete! 
echo Your site is now populated with fresh data.
pause
