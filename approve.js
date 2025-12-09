/**
 * approve.js – per-row blue ✔ Approve button (single approver, settings.txt driven)
 *
 * Usage:
 *   node approve.js requests.csv
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

// -------- LOAD settings.txt --------

const SETTINGS_PATH = "settings.txt";
let settings = {};

if (fs.existsSync(SETTINGS_PATH)) {
  const raw = fs.readFileSync(SETTINGS_PATH, "utf8")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith("#"));

  for (const line of raw) {
    const [k, v] = line.split("=");
    if (k && v) settings[k.trim()] = v.trim();
  }
}

// apply overrides from settings.txt
if (settings.url) cfg.urls.home = settings.url;
if (settings.approver) cfg.users.approver = settings.approver;
if (settings.edgeProfileUser) cfg.edgeProfileUser = settings.edgeProfileUser;

// timing overrides
if (!cfg.timing) cfg.timing = {};

if (settings.afterApproveWait) {
  const v = parseInt(settings.afterApproveWait, 10);
  if (!Number.isNaN(v)) cfg.timing.afterApproveWait = v;
}

if (settings.afterSearchWait) {
  const v = parseInt(settings.afterSearchWait, 10);
  if (!Number.isNaN(v)) cfg.timing.afterSearchWait = v;
}

// defaults
if (cfg.timing.afterApproveWait == null) cfg.timing.afterApproveWait = 18000;
if (cfg.timing.afterSearchWait == null) cfg.timing.afterSearchWait = 4000;


// -------- FOLDERS --------

const LOGS_DIR = path.resolve("logs");
const ERR_DIR = path.join(LOGS_DIR, "errors");
ensureDir(LOGS_DIR);
ensureDir(ERR_DIR);

// -------- BROWSER --------

function userDataDir() {
  return `C:\\Users\\${cfg.edgeProfileUser}\\AppData\\Local\\Microsoft\\Edge\\User Data`;
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
  } catch {}

  const browser = await chromium.launch({ headless: false, channel: "msedge" });
  return await browser.newContext({ viewport: { width: 1400, height: 900 } });
}

async function gotoHome(page) {
  await page.goto(cfg.urls.home, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

// -------- UTILS --------

async function safeScreenshot(page, suffix = "") {
  try {
    const file = path.join(
      ERR_DIR,
      `${ts().replace(/[: ]/g, "")}${suffix}.png`
    );
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

// -------- SWITCH USER --------

async function switchUser(page, who) {
  console.log(`→ Switching to: ${who}`);

  await clickIf(page, cfg.sel.switchLink);
  await sleep(300);

  await page.waitForSelector("text=Switch View").catch(() => {});

  const selectors = [
    'div[role="option"]:has-text("' + who + '")',
    'text="' + who + '"'
  ];

  for (const sel of selectors) {
    try {
      const loc = page.locator(sel);
      if (await loc.count()) {
        await loc.first().click({ force: true });
        await sleep(300);
        await clickIf(page, cfg.sel.switchConfirm);
        await page.waitForLoadState("networkidle").catch(() => {});
        await sleep(800);
        return;
      }
    } catch {}
  }

  await safeScreenshot(page, "-switch-failed");
  throw new Error("Could not switch user");
}

// -------- SEARCH INPUT --------

async function findSearchInput(page) {
  const sels = [
    'input[placeholder*="Search"]',
    'input[placeholder]'
  ];

  for (const sel of sels) {
    const loc = page.locator(sel);
    if (await loc.count()) return loc.first();
  }

  throw new Error("Search input not found");
}

async function fillSearch(page, input, id) {
  await input.click({ clickCount: 3 }).catch(() => {});
  await input.fill("");
  await sleep(150);
  await input.fill(id);
  await sleep(200);
  await clickIf(page, cfg.sel.searchBtn);
}

// -------- WAIT FOR RESULT --------

async function waitForResult(page, id) {
  const sel = `a:has-text("${id}")`;
  const start = Date.now();
  const max = 40000;

  while (Date.now() - start < max) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) && (await loc.isVisible().catch(() => false))) {
      return true;
    }
    await sleep(700);
  }
  return false;
}

// -------- APPROVE BUTTON --------

async function clickApproveButton(page) {
  const candidates = [
    'span[title="Approve"] + button',
    'span[title="Approve"] ~ button'
  ];

  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) && (await loc.isVisible().catch(() => false))) {
      await loc.click({ force: true });
      return true;
    }
  }

  return false;
}

// -------- APPROVE ONE ID --------

async function approveOneInUser(page, id) {
  console.log(`\n→ Searching for ${id}`);

  const input = await findSearchInput(page);
  await fillSearch(page, input, id);

  // NEW WAIT (per settings.txt)
  await sleep(cfg.timing.afterSearchWait);

  const found = await waitForResult(page, id);
  if (!found) {
    console.log(`✗ Not found`);
    return false;
  }

  console.log(`✓ Found, clicking Approve...`);
  const ok = await clickApproveButton(page);
  if (!ok) return false;

  await sleep(cfg.timing.afterApproveWait);
  console.log(`✓ Approved ${id}`);
  return true;
}

// -------- MAIN LOOP --------

async function approveInUser(page, ids, userLabel, logPath) {
  const remaining = [];

  for (const id of ids) {
    const ok = await approveOneInUser(page, id);
    if (ok) {
      appendLog(logPath, `${ts()},${id},approved,approved in ${userLabel}\n`);
    } else {
      remaining.push(id);
    }
  }

  return remaining;
}

// -------- MAIN --------

async function main() {
  const csv = process.argv[2] || "requests.csv";
  if (!fs.existsSync(csv)) return console.error("Missing requests.csv");

  const ids = readRequests(csv);
  if (!ids.length) return console.error("CSV empty");

  const logPath = path.join(LOGS_DIR, `run-${ts()}.csv`);
  appendLog(logPath, "time,request_id,result,notes\n");

  const context = await startBrowser();
  const page = await context.newPage();

  try {
    await gotoHome(page);

    // ensure correct approver
    const body = await page.textContent("body").catch(() => "");
    if (!body.includes(cfg.users.approver)) {
      await switchUser(page, cfg.users.approver);
    }

    const remaining = await approveInUser(
      page,
      ids,
      cfg.users.approver,
      logPath
    );

    for (const id of remaining) {
      appendLog(logPath, `${ts()},${id},not_found,not found for approver\n`);
    }

    console.log("\nDONE. Log:", logPath);
    await context.close();
  } catch (err) {
    console.error("Fatal:", err);
    await safeScreenshot(page, "-fatal");
  }
}

main();
