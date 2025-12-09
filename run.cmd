@echo off
cd /d "%~dp0"

echo ============================================
echo   Auto Approver - Starting
echo ============================================
echo.

echo Closing Microsoft Edge...
taskkill /IM msedge.exe /F >nul 2>&1

echo Running Edge setup script...
node edge.js

echo Running Approver script...
node approve.js requests.csv

echo.
echo ============================================
echo   DONE. Check logs folder for results.
echo ============================================
echo.
pause
