/**
 * approve.js – single approver automation (same logic as your working version)
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

/* Edge profile path */
function userDataDir() {
  return `C:\\Users\\${cfg.edgeProfileUser}\\AppData\\Local\\Microsoft\\Edge\\User Data`;
}

/* Start browser as persistent user */
async function startBrowser() {
  const profile = userDataDir();
  if (fs.existsSync(profile)) {
    return chromium.launchPersistentContext(profile, {
      headless: false,
      channel: "msedge",
      viewport: { width: 1400, height: 900 }
    });
  }
  const browser = await chromium.launch({ headless: false, channel: "msedge" });
  return browser.newContext({ viewport: { width: 1400, height: 900 } });
}

/* Navigate to portal */
async function gotoHome(page) {
  await page.goto(cfg.urls.home, { waitUntil: "domcontentloaded" });
  await sleep(cfg.timing.initialPageWait);
}

/* Generic safe screenshot */
async function safeScreenshot(page, suffix = "") {
  try {
    const file = path.join(ERR_DIR, `${ts().replace(/[: ]/g, "")}${suffix}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } catch {}
}

/* Switch View */
async function switchUser(page, who) {
  console.log(`→ Switching into: ${who}`);

  await sleep(cfg.timing.waitBeforeSwitch);

  await page.locator(cfg.sel.switchLink).first().click({ force: true });
  await page.waitForSelector('text=Switch View').catch(() => {});

  const option = page.locator(`text="${who}"`).first();
  await option.click({ force: true }).catch(() => {});
  await page.locator(cfg.sel.switchConfirm).click({ force: true }).catch(() => {});

  await sleep(cfg.timing.waitAfterSwitch);
}

/* Find search input (same logic) */
async function findSearchInput(page) {
  const sel = [
    'input[placeholder*="Search by request"]',
    'input[placeholder*="Search"]'
  ];
  for (const s of sel) {
    const loc = page.locator(s);
    if (await loc.count()) return loc.first();
  }
  throw new Error("Search input not found");
}

/* Fill Search */
async function fillSearch(page, input, id) {
  await input.click({ clickCount: 3, force: true });
  await input.fill(id);
  await input.press("Enter").catch(() => {});
  await sleep(cfg.timing.waitAfterSearch);
}

/* Wait for result */
async function waitForResult(page, id) {
  const sel = `a:has-text("${id}")`;
  for (let i = 0; i < 40; i++) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) && (await loc.isVisible())) return true;
    await sleep(1000);
  }
  return false;
}

/* Click blue Approve button */
async function clickApproveButton(page) {
  const candidates = [
    'span[title="Approve"] + button',
    'span[title="Approve"] ~ button',
    'span.mr-2 + button'
  ];

  for (const c of candidates) {
    const btn = page.locator(c).first();
    if ((await btn.count()) && (await btn.isVisible())) {
      await btn.click({ force: true });
      return true;
    }
  }
  return false;
}

/* Approve One ID */
async function approveOne(page, id, index, total) {
  console.log(`\n[${index}/${total}] → Searching ${id}`);

  const input = await findSearchInput(page);
  await fillSearch(page, input, id);

  const found = await waitForResult(page, id);
  if (!found) {
    console.log(`  ✗ Not found`);
    return false;
  }

  console.log(`  ✓ Found, clicking Approve…`);
  const clicked = await clickApproveButton(page);
  if (!clicked) {
    console.log(`  ✗ Approve button not found`);
    return false;
  }

  await sleep(cfg.timing.afterApproveWait);
  console.log(`  ✓ Approved!`);
  return true;
}

/* Main */
async function main() {
  const csv = process.argv[2] || "requests.csv";
  const ids = readRequests(csv);

  const logPath = path.join(LOGS_DIR, `run-${ts().replace(/[: ]/g, "")}.csv`);
  appendLog(logPath, "time,request_id,result\n");

  const context = await startBrowser();
  const page = await context.newPage();

  await gotoHome(page);

  const body = await page.textContent("body").catch(() => "");
  if (!body.includes(cfg.users.approver)) {
    await switchUser(page, cfg.users.approver);
  }

  let index = 1;
  for (const id of ids) {
    const ok = await approveOne(page, id, index, ids.length);
    appendLog(
      logPath,
      `${ts()},${id},${ok ? "approved" : "not_found"}\n`
    );
    index++;
  }

  console.log("\n✔ DONE. Log file:", logPath);
  await context.close();
}

main();
