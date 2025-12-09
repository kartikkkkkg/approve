@echo off
echo ------ DEBUG MODE STARTED ------
echo Script folder: "%~dp0"
cd /d "%~dp0"

echo.
echo Checking Node path...
where node
echo.

echo Running: node approve.js requests.csv
echo ---------------------------------------
node approve.js requests.csv

echo ---------------------------------------
echo Script finished. Press any key to exit.
pause
