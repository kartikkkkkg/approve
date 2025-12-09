@echo off
echo Starting Approver Automation...
echo.

REM Use this folder as working directory
cd /d "%~dp0"

REM Show Node version (debugging)
node -v
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Download from: https://nodejs.org/
    pause
    exit /b
)

echo Running approve.js...
echo.

REM Run script with requests.csv
node approve.js requests.csv

echo.
echo -------------------------------
echo Script finished.
echo Press any key to close window.
echo -------------------------------
pause >nul
