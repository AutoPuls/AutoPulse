@echo off
title AutoPulse HYPER SYNC (100k Target)
echo ========================================================
echo 🌩️  AUTOPULSE HYPER SYNC: VOLUME + SPEED + QUALITY
echo ========================================================
echo.
echo Mode: HYPER (Concurrent Batch Processing + Asset Interception)
echo Goal: Scaled extraction of up to 100,000 cars perfectly matched for UI.
echo.

:: Override env vars for this session
SET SWEEP_CONCURRENCY=1
SET MAX_PAGES_PER_CITY=15
SET DEEP_ENRICH=true

npm run agency-sweep
pause
