@echo off
cd /d "%~dp0"

echo ====================================================
echo    AutoPulse: Repair Tool (Old Listing Info)
echo ====================================================
echo.
echo This tool will fix the 50 newest listings that are 
echo currently missing info (Mileage, Description, etc.)
echo.
echo [1] Checking environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    pause
    exit /b
)

echo [2] Starting Repair Batch...
npm run db:fix-info

echo.
echo Batch Complete! 
echo You can run this file again to fix the next 50 listings.
pause
