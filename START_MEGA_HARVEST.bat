@echo off
title AutoPulse Mega Harvest
echo ===========================================
echo   AutoPulse Mega Harvest (Top 40 Cities)
echo ===========================================
echo   RAM Target: 16GB (4 Parallel Browsers)
echo   Strategy: Deep Scroll (40 iterations)
echo ===========================================
echo.
powershell -ExecutionPolicy Bypass -Command "npx tsx scripts/megaHarvest.ts"
echo.
echo Harvest Complete! Press any key to exit.
pause
