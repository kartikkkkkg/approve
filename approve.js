/**
 * approve.js – per-row blue ✔ Approve button (single approver)
 *
 * Usage:
 *   node approve.js requests.csv
 *
 * Logic is the same as your working version:
 * - same switchUser dropdown logic
 * - same search behavior
 * - same blue "Approve" button selectors
 * Only difference: timing & edgeProfileUser are configurable via settings.txt.
 */

import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { cfg } from "./config.js";
import {
  ensureDir,
  ts,
  readRequests,
  appendLog,
  sleep,
  saveText
} from "./utils.js";

const LOGS_DIR = path.resolve("logs");
const ERR_DIR = path.join(LOGS_DIR, "errors");
ensureDir(LOGS_DIR);
ensureDir(ERR_DIR);

function userDataDir() {
  // now uses cfg.edgeProfileUser (from settings.txt or default)
  return `C:\\Users\\${cfg.edgeProfileUser}\\AppData\\Local\\Microsoft\\Edge\\User Data`;
}

/* ───────── browser startup ───────── */

async function startBrowser() {
  const profile = userDataDir();
  try {
    if (fs.existsSync(profile)) {
      return await chromium.launchPersistentContext(profile, {
        headless: false,
        channel: "msedge",
        viewport: { width: 1400, height: 900 }
      });
    }
  } catch (e) {
    console.warn("Persistent context failed:", e.message);
  }
  const browser = await chromium.launch({ headless: false, channel: "msedge" });
  return await browser.newContext({ viewport: { width: 1400, height: 900 } });
}

async function gotoHome(page) {
  await page.goto(cfg.urls.home, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  // NEW: extra configurable wait after landing on homepage
  if (cfg.timing.initialPageWait > 0) {
    await sleep(cfg.timing.initialPageWait);
  }
}

async function safeScreenshot(page, suffix = "") {
  try {
    const file = path.join(
      ERR_DIR,
      `${ts().replace(/[: ]/g, "")}${suffix}.png`
    );
    await page.screenshot({ path: file, fullPage: true });
    console.log("Saved screenshot:", file);
    return file;
  } catch (e) {
    console.warn("screenshot failed:", e.message);
    return null;
  }
}

async function clickIf(page, selector) {
  try {
    const loc = page.locator(selector);
    if (await loc.count()) {
      await loc.first().click({ force: true });
      return true;
    }
  } catch (e) {}
  return false;
}

/* ───────────────── switch user (SAME LOGIC, now with timing) ───────────────── */

async function switchUser(page, who) {
  console.log(`→ switchUser: "${who}"`);

  // NEW: configurable delay before touching the Switch UI
  if (cfg.timing.waitBeforeSwitch > 0) {
    await sleep(cfg.timing.waitBeforeSwitch);
  }

  await clickIf(page, cfg.sel.switchLink);
  await sleep(300);

  await page
    .waitForSelector("text=Switch View", { timeout: 6000 })
    .catch(() => {});

  const openerCandidates = [
    'div[role="dialog"] >> text="Select..."',
    'div[role="dialog"] >> text=Select',
    'div[role="dialog"] >> .select__control',
    'div[role="dialog"] >> button[aria-haspopup="listbox"]',
    'div[role="dialog"] >> [role="combobox"]'
  ];

  let opened = false;
  for (const s of openerCandidates) {
    try {
      const loc = page.locator(s);
      if (await loc.count()) {
        await loc.first().click({ force: true });
        opened = true;
        await sleep(220);
        break;
      }
    } catch (e) {}
  }

  if (!opened) {
    try {
      const dialog = page.locator('div[role="dialog"]').first();
      if (await dialog.count()) {
        const box = await dialog.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width - 60, box.y + 60, {
            force: true
          });
          opened = true;
          await sleep(250);
        }
      }
    } catch (e) {}
  }

  await sleep(220);

  const optionSelectors = [
    `div[role="option"]:has-text("${who}")`,
    `div[role="dialog"] >> text="${who}"`,
    `text="${who}"`,
    `li:has-text("${who}")`,
    `div:has-text("${who}")`
  ];

  let selected = false;
  for (const sel of optionSelectors) {
    try {
      const loc = page.locator(sel);
      if (await loc.count()) {
        await loc.first().click({ force: true });
        console.log("   clicked option via selector:", sel);
        selected = true;
        await sleep(150);
        break;
      }
    } catch (e) {}
  }

  if (!selected) {
    const shot = await safeScreenshot(page, "-switch-failed");
    await saveText(
      "switch-error.txt",
      `Could not select "${who}" in Switch dialog. Screenshot: ${shot}\n`
    );
    throw new Error(`switchUser: unable to select "${who}". Screenshot: ${shot}`);
  }

  await clickIf(page, cfg.sel.switchConfirm);
  await page.waitForLoadState("networkidle").catch(() => {});

  // NEW: configurable delay after switching user
  if (cfg.timing.waitAfterSwitch > 0) {
    await sleep(cfg.timing.waitAfterSwitch);
  } else {
    // preserve old behavior if not configured
    await sleep(600);
  }
}

/* ───────────────── search helpers (same logic) ───────────────── */

async function findSearchInput(page, timeout = 15000) {
  const placeholders = [
    'input[placeholder*="Search by request ID"]',
    'input[placeholder*="Search by request"]',
    'input[placeholder*="Search"]'
  ];

  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of placeholders) {
      try {
        const loc = page.locator(sel);
        if (await loc.count()) {
          const count = await loc.count();
          for (let i = 0; i < count; i++) {
            const l = loc.nth(i);
            if (await l.isVisible().catch(() => false)) return l;
          }
        }
      } catch (e) {}
    }

    // fallback: the react-select container you showed in screenshots
    try {
      const container = page
        .locator('div[id^="Search-"], div.react-select, div.search-container')
        .first();
      if (await container.count()) {
        const innerInput = container.locator("input").first();
        if (
          (await innerInput.count()) &&
          (await innerInput.isVisible().catch(() => false))
        ) {
          return innerInput;
        }
      }
    } catch (e) {}

    await sleep(300);
  }

  throw new Error("Search input not found on page");
}

async function fillSearch(page, inputLoc, id) {
  await inputLoc.scrollIntoViewIfNeeded().catch(() => {});
  await inputLoc.click({ clickCount: 3, force: true }).catch(() => {});
  await inputLoc.fill("");
  await sleep(120);
  await inputLoc.fill(id);
  await sleep(250);
  try {
    await inputLoc.press("Enter");
  } catch {}
  await clickIf(page, cfg.sel.searchBtn);
}

/** Wait for a link with the request ID to appear (maxMs configurable) */
async function waitForResult(page, id, maxMs = 40000) {
  const sel = `a:has-text("${id}")`;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) && (await loc.isVisible().catch(() => false))) {
      return true;
    }
    await sleep(700);
  }
  return false;
}

/* ───────────────── click blue ✔ Approve button (same selectors) ───────────────── */

async function clickApproveButton(page) {
  const candidates = [
    'span[title="Approve"] + button',
    'span[title="Approve"] ~ button',
    'span.mr-2 + button'
  ];

  for (const sel of candidates) {
    try {
      const loc = page.locator(sel).first();
      if ((await loc.count()) && (await loc.isVisible().catch(() => false))) {
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        await loc.click({ force: true });
        return true;
      }
    } catch (e) {}
  }

  try {
    const handle = await page.$('span[title="Approve"]');
    if (handle) {
      await page.evaluate((span) => {
        const container = span.closest("div");
        if (!container) return;
        const btn =
          container.querySelector("button") ||
          container.parentElement?.querySelector("button");
        if (btn) btn.click();
      }, handle);
      await sleep(500);
      return true;
    }
  } catch (e) {}

  await safeScreenshot(page, "-approve-btn-not-found");
  return false;
}

/* ───────────────── approve one ID in current user ───────────────── */

async function approveOneInUser(page, id) {
  console.log(`  → Searching for ${id} ...`);

  const inputLoc = await findSearchInput(page, 8000);
  await fillSearch(page, inputLoc, id);

  const maxWait = cfg.timing.waitAfterSearch || 40000;
  const found = await waitForResult(page, id, maxWait);
  if (!found) {
    console.log(`  ✗ Not found for this user: ${id}`);
    return false;
  }

  console.log(`  ✓ Found ${id}, clicking blue Approve button...`);

  const clicked = await clickApproveButton(page);
  if (!clicked) {
    console.log(`  ✗ Could not click Approve for ${id}`);
    return false;
  }

  const afterApprove = cfg.timing.afterApproveWait || 18000;
  await sleep(afterApprove);
  console.log(
    `  ✓ Approved ${id} (waited ~${Math.round(afterApprove / 1000)}s)\n`
  );
  return true;
}

/* ───────────────── run through all IDs for a given user (with progress) ───────────────── */

async function approveInUser(page, ids, userLabel, logPath, notePrefix) {
  console.log(`\n===== Approving as ${userLabel} =====`);
  const total = ids.length;
  let approvedCount = 0;
  let processedCount = 0;
  const remaining = [];

  console.log(`Total IDs: ${total}\n`);

  for (const id of ids) {
    processedCount++;

    let ok = false;
    try {
      ok = await approveOneInUser(page, id);
    } catch (e) {
      console.warn(`  !! Error for ${id}:`, e.message);
      ok = false;
    }

    if (ok) {
      approvedCount++;
      appendLog(
        logPath,
        `${ts()},${id},approved_in_${notePrefix},approved in ${userLabel}\n`
      );
    } else {
      remaining.push(id);
    }

    console.log(
      `Progress → Approved: ${approvedCount}/${total} | Remaining to process: ${
        total - processedCount
      }`
    );
  }

  console.log(
    `Finished for ${userLabel}. Approved: ${
      approvedCount
    }, Remaining/failed: ${remaining.length}\n`
  );
  return remaining;
}

/* ───────────────── MAIN ───────────────── */

async function main() {
  const csv = process.argv[2] || "requests.csv";
  if (!fs.existsSync(csv)) {
    console.error("requests.csv missing");
    return;
  }
  const ids = readRequests(csv);
  if (!ids.length) {
    console.error("No IDs found in CSV");
    return;
  }

  const logPath = path.join(LOGS_DIR, `run-${ts().replace(/[: ]/g, "")}.csv`);
  appendLog(logPath, "time,request_id,result,notes\n");

  const context = await startBrowser();
  const page = await context.newPage();

  try {
    await gotoHome(page);

    // make sure we are in the desired approver view
    const body = await page.textContent("body").catch(() => "");
    if (!body.includes(cfg.users.approver)) {
      await switchUser(page, cfg.users.approver);
    }

    const remaining = await approveInUser(
      page,
      ids,
      cfg.users.approver,
      logPath,
      "approver"
    );

    for (const id of remaining) {
      appendLog(
        logPath,
        `${ts()},${id},not_found_in_approver,not found for ${cfg.users.approver}\n`
      );
    }

    console.log("\n✔ DONE. See log:", logPath);
    await context.close();
  } catch (err) {
    console.error("Fatal error:", err.message);
    const shot = await safeScreenshot(page, "-fatal");
    await saveText(
      "fatal-error.txt",
      `${err.stack}\nScreenshot: ${shot}\n`
    );
    console.log("Browser left open for inspection (check logs/errors).");
  }
}

main().catch((e) => console.error("unhandled:", e));
