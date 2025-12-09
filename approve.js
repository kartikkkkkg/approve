/**
 * approve.js – single-approver version with per-row blue Approve button
 * Supports settings.txt override for approver + URL
 * Uses isolated Edge profile → NO NEED to kill Edge
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

// --- LOAD OVERRIDES FROM settings.txt ------------------------------------

function loadOverridesFromTxt() {
  const overrides = {};
  try {
    if (!fs.existsSync("settings.txt")) return overrides;

    const lines = fs.readFileSync("settings.txt", "utf8")
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const [key, val] = line.split("=");
      if (key && val) overrides[key.trim()] = val.trim();
    }
  } catch (e) {
    console.warn("Could not read settings.txt:", e.message);
  }
  return overrides;
}

const txt = loadOverridesFromTxt();

// Build final config used by script:
const activeCfg = {
  ...cfg,
  urls: {
    ...cfg.urls,
    ...(txt.url ? { home: txt.url } : {})
  },
  users: {
    ...cfg.users,
    ...(txt.approver ? { approver: txt.approver } : {})
  }
};

// -------------------------------------------------------------------------

const LOGS_DIR = path.resolve("logs");
const ERR_DIR = path.join(LOGS_DIR, "errors");
ensureDir(LOGS_DIR);
ensureDir(ERR_DIR);

// 🟦 IMPORTANT: USE PRIVATE EDGE PROFILE → No need to close MS Edge!
function userDataDir() {
  return path.resolve("edge-profile");
}

/* ───────── browser startup ───────── */

async function startBrowser() {
  const profile = userDataDir();
  ensureDir(profile);

  return await chromium.launchPersistentContext(profile, {
    headless: false,
    channel: "msedge",
    viewport: { width: 1500, height: 900 }
  });
}

async function gotoHome(page) {
  console.log("→ Loading portal:", activeCfg.urls.home);
  await page.goto(activeCfg.urls.home, { waitUntil: "domcontentloaded" });

  // ⏱ Increase this for slow internet
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(2000); // extra buffer
}

/* --------------------- Screenshot helper --------------------- */
async function safeScreenshot(page, suffix = "") {
  try {
    const file = path.join(ERR_DIR, `${ts().replace(/[: ]/g, "")}${suffix}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } catch {
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
  } catch {}
  return false;
}

/* ───────── SWITCH USER ───────── */

async function switchUser(page, who) {
  console.log(`→ Switching to: ${who}`);

  await clickIf(page, activeCfg.sel.switchLink);
  await sleep(400);

  await page.waitForSelector("text=Switch View", { timeout: 7000 }).catch(()=>{});

  const opener = [
    'div[role="dialog"] >> text="Select"',
    'div[role="dialog"] >> .select__control',
    'div[role="dialog"] >> [role="combobox"]'
  ];

  let opened = false;
  for (const s of opener) {
    if (await page.locator(s).count()) {
      await page.locator(s).first().click({ force: true });
      opened = true;
      await sleep(300);
      break;
    }
  }

  if (!opened) {
    const dialog = page.locator('div[role="dialog"]').first();
    if (await dialog.count()) {
      const box = await dialog.boundingBox();
      await page.mouse.click(box.x + box.width - 40, box.y + 40);
      await sleep(300);
    }
  }

  const options = [
    `div[role="option"]:has-text("${who}")`,
    `text="${who}"`,
    `li:has-text("${who}")`
  ];

  for (const sel of options) {
    if (await page.locator(sel).count()) {
      await page.locator(sel).first().click({ force: true });
      await sleep(200);
      await clickIf(page, activeCfg.sel.switchConfirm);
      await sleep(1500);
      return;
    }
  }

  const shot = await safeScreenshot(page, "-switch-failed");
  throw new Error(`Could not switch to ${who}. Screenshot: ${shot}`);
}

/* ───────── SEARCH ───────── */

async function findSearchInput(page, timeout = 15000) {
  const selectors = [
    'input[placeholder*="Search"]',
    'input[placeholder*="request"]'
  ];

  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const loc = page.locator(sel);
      if (await loc.count() && await loc.first().isVisible().catch(()=>false))
        return loc.first();
    }
    await sleep(300);
  }

  throw new Error("Search input not found");
}

async function fillSearch(page, input, id) {
  await input.fill("");
  await sleep(100);
  await input.fill(id);
  await sleep(250);
  await input.press("Enter").catch(()=>{});
  await clickIf(page, activeCfg.sel.searchBtn);
}

async function waitForResult(page, id, timeout = 45000) {
  const sel = `a:has-text("${id}")`;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const loc = page.locator(sel).first();
    if (await loc.count() && await loc.isVisible().catch(()=>false)) return true;
    await sleep(800);
  }
  return false;
}

/* ───────── APPROVE CLICK ───────── */

async function clickApproveButton(page) {
  const candidates = [
    'span[title="Approve"] + button',
    'span[title="Approve"] ~ button'
  ];

  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      await loc.click({ force: true });
      return true;
    }
  }

  return false;
}

/* ───────── APPROVE ONE ID ───────── */

async function approveOne(page, id) {
  console.log(`→ Searching for: ${id}`);

  const input = await findSearchInput(page);
  await fillSearch(page, input, id);

  const found = await waitForResult(page, id);
  if (!found) return false;

  console.log("  ✓ Found. Clicking Approve…");

  const clicked = await clickApproveButton(page);
  if (!clicked) return false;

  // ⏱ TIME TO WAIT AFTER CLICK
  await sleep(activeCfg.timing.afterApproveWait);

  console.log(`  ✓ Approved ${id}`);
  return true;
}

/* ───────── RUN LIST ───────── */

async function approveList(page, ids, userLabel, logFile) {
  const remaining = [];

  for (const id of ids) {
    const ok = await approveOne(page, id);
    if (ok)
      appendLog(logFile, `${ts()},${id},approved,${userLabel}\n`);
    else
      remaining.push(id);
  }
  return remaining;
}

/* ───────── MAIN ───────── */

async function main() {
  const csv = process.argv[2] || "requests.csv";
  const ids = readRequests(csv);
  if (!ids.length) return console.log("No IDs found.");

  const logFile = path.join(LOGS_DIR, `run-${ts()}.csv`);
  appendLog(logFile, "time,id,result,notes\n");

  const ctx = await startBrowser();
  const page = await ctx.newPage();

  await gotoHome(page);

  // Switch to correct approver
  const body = await page.textContent("body").catch(()=> "");
  if (!body.includes(activeCfg.users.approver)) {
    await switchUser(page, activeCfg.users.approver);
  }

  const remaining = await approveList(page, ids, activeCfg.users.approver, logFile);

  for (const id of remaining)
    appendLog(logFile, `${ts()},${id},not_found,not in approver view\n`);

  console.log("✔ Completed. Log:", logFile);
  await ctx.close();
}

main();
