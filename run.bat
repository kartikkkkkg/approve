@echo off
echo Starting Approver Tool...
echo.

rem Go to the folder where this BAT file is located
cd /d "%~dp0"

rem (Optional) Show node path
echo Using Node:
where node
echo.

rem Run the script
node approve.js requests.csv

echo.
echo Finished. Press any key to exit.
pause
