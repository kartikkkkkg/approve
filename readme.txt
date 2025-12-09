🚀 WFM Request Auto-Approver (Single Approver Version)

This tool automatically approves Workforce Management requests using Playwright + Microsoft Edge.

It is designed so that any team can use it simply by editing settings.txt — no coding required.

📁 Folder Overview
approve.js        → Main automation script  
config.js         → Loads settings & exposes them to the script  
utils.js          → Helper functions + “settings.txt” reader  
settings.txt      → Team settings (approver name, URL, timing overrides)  
requests.csv      → List of request IDs to approve  
logs/             → Generated approval logs  
logs/errors/      → Error screenshots  

🧩 1. First-Time Setup (One-Time Only)
Step 1 — Install Node.js

Download and install the LTS version from:
👉 https://nodejs.org/

Step 2 — Install Playwright

Open Command Prompt inside the folder and run:

npm init -y
npm install playwright
npx playwright install msedge

Step 3 — Configure Team Settings

Open settings.txt and edit:

approver=Eder, Noelle
url=https://<portal-url-here>

initialPageWait=5000
waitBeforeSwitch=2000
waitAfterSwitch=6000
waitAfterSearch=2500
afterApproveWait=18000


✔ Change approver= → the user who approves
✔ Change url= → the WFM portal URL
✔ Adjust timing values if laptop/internet is slow or fast

Step 4 — Create requests.csv

Example:

1234567
9876543
5566778


One request ID per line.

⚡ 2. Daily Usage (Everyday Process)
Step 1 — CLOSE ALL Edge Windows

This is required so automation can attach to your Edge profile.

Step 2 — Run the Script

Open Command Prompt in the folder:

node approve.js requests.csv

Step 3 — Let It Run Automatically

The script will:

Open the portal

Switch to the approver specified in settings.txt

Search each request ID

Click the blue Approve button

Wait for backend to complete

Move to the next ID

Log results in /logs

Step 4 — Check the Log File

Example format:

time,request_id,result,notes
20250201_103022,1234567,approved,approved in Eder, Noelle
20250201_103041,9876543,not_found_in_approver,not found for Eder, Noelle


Stored in:

logs/run-YYYYMMDD_HHMMSS.csv

⚙️ 3. Adjusting Timings for Different Laptops

Users do NOT need to edit code.

They adjust values in settings.txt:

initialPageWait=7000      # time to let full portal load
waitBeforeSwitch=3000     # pause before opening Switch View dropdown
waitAfterSwitch=8000      # time after switching approver
waitAfterSearch=4000      # let search results load
afterApproveWait=20000    # time after clicking Approve


Slow laptop/WiFi → increase the numbers
Fast laptop → decrease the numbers

🛠️ 4. Common Problems & Fixes
❌ Problem: Script opens Edge in "InPrivate"

Cause: Edge was already running
Fix: Close all Edge windows → run again

❌ Problem: Switch View is not appearing

Increase:

waitBeforeSwitch=3000
waitAfterSwitch=8000

❌ Problem: Search bar not found

Increase:

initialPageWait=7000
waitAfterSearch=4000

❌ Problem: Approve button fails to click

UI slow → increase:

afterApproveWait=22000

👥 5. How Any Team Can Use It

Each team only edits:

settings.txt
requests.csv


No code changes needed.

Steps:

Install Node + Playwright once

Update approver= and url=

Add request IDs

Run the script
