/**
 * approve.js – per-row blue ✔ Approve button (single approver)
 *
 * Usage:
 *   node approve.js requests.csv
 *
 * Built from your working repo logic:
 * - same switchUser
 * - same search behaviour
 * - same blue Approve button click
 * Just:
 *   + progress logs
 *   + optional settings.txt overrides (url, approver, afterApproveWait)
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

/* ─────────────────────────────────────────
   SETTINGS.TXT OVERRIDES (LIGHT TOUCH)
   ───────────────────────────────────────── */

function loadSettings() {
  const file = "settings.txt";
  const out = {};
  try {
    if (!fs.existsSync(file)) return out;
    const lines = fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    for (const line of lines) {
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!key) continue;
      out[key] = val;
    }
  } catch (e) {
    console.warn("Could not read settings.txt:", e.message);
  }
  return out;
}

const settings = loadSettings();

// make a shallow clone so we don't mutate original cfg
const activeCfg = JSON.parse(JSON.stringify(cfg));

// URL override: use settings.url if present
if (settings.url) {
  if (activeCfg.urls) {
    activeCfg.urls.home = settings.url;
    activeCfg.urls.homeNoelle = settings.url;
  } else {
    activeCfg.urls = { home: settings.url, homeNoelle: settings.url };
  }
}

// Approver override: single approver name
// fallback order: settings.approver -> users.approver -> users.noelle
if (!activeCfg.users) activeCfg.users = {};
if (settings.approver) {
  activeCfg.users.approver = settings.approver;
}
const APPROVER_NAME =
  activeCfg.users.approver || activeCfg.users.noelle || activeCfg.users.kartik;

// Edge profile user override (if you want)
if (settings.edgeProfileUser) {
  activeCfg.edgeProfileUser = settings.edgeProfileUser;
}

// Timing override: afterApproveWait (ms)
// defaults to the 18000 you already used
if (!activeCfg.timing) activeCfg.timing = {};
if (settings.afterApproveWait) {
  const v = parseInt(settings.afterApproveWait, 10);
  if (!Number.isNaN(v) && v > 0) {
    activeCfg.timing.afterApproveWait = v;
  }
}
if (activeCfg.timing.afterApproveWait == null) {
  activeCfg.timing.afterApproveWait = 18000;
}

/* ─────────────────────────────────────────
   LOG FOLDERS
   ───────────────────────────────────────── */

const LOGS_DIR = path.resolve("logs");
const ERR_DIR = path.join(LOGS_DIR, "errors");
ensureDir(LOGS_DIR);
ensureDir(ERR_DIR);

/* ─────────────────────────────────────────
   BROWSER START (SAME APPROACH)
   ───────────────────────────────────────── */

function userDataDir() {
  // same as repo – uses your real Edge profile
  const user = activeCfg.edgeProfileUser || process.env.USERNAME || "";
  return `C:\\Users\\${user}\\AppData\\Local\\Microsoft\\Edge\\User Data`;
}

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

function getHomeUrl() {
  if (activeCfg.urls?.home) return activeCfg.urls.home;
  if (activeCfg.urls?.homeNoelle) return activeCfg.urls.homeNoelle;
  throw new Error("No home URL configured in cfg.urls / settings.txt");
}

async function gotoHome(page) {
  const url = getHomeUrl();
  console.log("→ Opening:", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/* ─────────────────────────────────────────
   UTILS (same as your repo versions)
   ───────────────────────────────────────── */

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

/* ─────────────────────────────────────────
   SWITCH USER (your robust working logic)
   ───────────────────────────────────────── */

async function switchUser(page, who) {
  console.log(`→ switchUser: "${who}"`);

  await clickIf(page, activeCfg.sel.switchLink);
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

  for (const sel of optionSelectors) {
    try {
      const loc = page.locator(sel);
      if (await loc.count()) {
        await loc.first().click({ force: true });
        console.log("   clicked option via selector:", sel);
        await sleep(150);
        await clickIf(page, activeCfg.sel.switchConfirm);
        await page.waitForLoadState("networkidle").catch(() => {});
        await sleep(600);
        return;
      }
    } catch (e) {}
  }

  const shot = await safeScreenshot(page, "-switch-failed");
  await saveText(
    "switch-error.txt",
    `Could not select "${who}" in Switch dialog. Screenshot: ${shot}\n`
  );
  throw new Error(`switchUser: unable to select "${who}". Screenshot: ${shot}`);
}

/* ─────────────────────────────────────────
   SEARCH HELPERS (same logic as repo)
   ───────────────────────────────────────── */

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
  await clickIf(page, activeCfg.sel.searchBtn);
}

/** Wait up to 40s for a link with the request ID to appear */
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

/* ─────────────────────────────────────────
   CLICK BLUE ✔ APPROVE BUTTON (same selectors)
   ───────────────────────────────────────── */

async function clickApproveButton(page) {
  const candidates = [
    'span[title="Approve"] + button', // span with title Approve, then its button
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

  // last-resort: use JS to go from span[title=Approve] to its nearest button
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

/* ─────────────────────────────────────────
   APPROVE ONE ID (logic same, timing configurable)
   ───────────────────────────────────────── */

async function approveOneInUser(page, id) {
  console.log(`  → Searching for ${id} ...`);

  const inputLoc = await findSearchInput(page, 8000);
  await fillSearch(page, inputLoc, id);

  const found = await waitForResult(page, id, 40000);
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

  const waitMs = activeCfg.timing.afterApproveWait ?? 18000;
  await sleep(waitMs);
  console.log(
    `  ✓ Approved ${id} (waited ~${Math.round(waitMs / 1000)}s)\n`
  );
  return true;
}

/* ─────────────────────────────────────────
   LOOP THROUGH IDs (PROGRESS ADDED)
   ───────────────────────────────────────── */

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

/* ─────────────────────────────────────────
   MAIN (single approver only)
   ───────────────────────────────────────── */

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

    // ensure we are in the desired approver view
    const body = await page.textContent("body").catch(() => "");
    if (!body.includes(APPROVER_NAME)) {
      await switchUser(page, APPROVER_NAME);
    }

    const remaining = await approveInUser(
      page,
      ids,
      APPROVER_NAME,
      logPath,
      "approver"
    );

    for (const id of remaining) {
      appendLog(
        logPath,
        `${ts()},${id},not_found_in_approver,not found for ${APPROVER_NAME}\n`
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
