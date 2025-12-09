@echo off
cd /d "%~dp0"

echo ==============================
echo AUTO APPROVER - STARTING
echo Running in folder: %cd%
echo ==============================
echo.

:: Check if Node exists
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is NOT installed or not in PATH.
    echo Install from: https://nodejs.org
    echo.
    pause
    exit /b
)

echo Node found:
node -v
echo.

echo Running Approver Script...
echo ------------------------------
node approve.js requests.csv
echo ------------------------------

echo.
echo ✔ Script Finished.
pause
