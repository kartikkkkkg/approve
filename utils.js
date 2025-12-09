import fs from "fs";
import path from "path";

/** Ensure directory exists */
export function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (e) {
    console.warn("ensureDir failed:", e.message);
  }
}

/** Timestamp string */
export function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Read CSV list of request IDs */
export function readRequests(csvPath) {
  const txt = fs.readFileSync(csvPath, "utf8");
  const lines = txt
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  // detect header and remove
  if (
    lines.length > 1 &&
    /[A-Za-z]/.test(lines[0]) &&
    !/^\d/.test(lines[0])
  ) {
    lines.shift();
  }

  return lines;
}

/** Append to CSV log */
export function appendLog(filePath, text) {
  try {
    fs.appendFileSync(filePath, text, "utf8");
  } catch (e) {
    console.warn("appendLog failed:", e.message);
  }
}

/** Sleep */
export function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/** Save text dump (useful for errors) */
export function saveText(name, text, dir = "logs/errors") {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, name);
    fs.writeFileSync(p, text, "utf8");
    return p;
  } catch (e) {
    console.warn("saveText failed:", e.message);
    return null;
  }
}
