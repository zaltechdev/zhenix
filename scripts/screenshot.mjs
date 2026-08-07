// Reusable Playwright screenshot helper.
// Usage: node scripts/screenshot.mjs <baseUrl> <outDir> <label> <w>x<h>:<path> [<w>x<h>:<path> ...]
// Example: node scripts/screenshot.mjs http://localhost:3000 screenshots before 1440x900:/ 1440x900:/sign-in
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const [baseUrl, outDir, label, ...shots] = process.argv.slice(2);
if (!baseUrl || !outDir || !label || shots.length === 0) {
  console.error("usage: node scripts/screenshot.mjs <baseUrl> <outDir> <label> <w>x<h>:<path> [...]");
  process.exit(1);
}

const root = resolve(outDir);
mkdirSync(root, { recursive: true });
const screenshotLocale = process.env.SCREENSHOT_LOCALE;
const screenshotTheme = process.env.SCREENSHOT_THEME;

const browser = await chromium.launch();
const results = [];
for (const shot of shots) {
  const [size, path] = shot.split(":");
  const [w, h] = size.split("x").map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  if (screenshotLocale) {
    await page.context().addCookies([{ name: "PARAGLIDE_LOCALE", value: screenshotLocale, url: baseUrl }]);
  }
  if (screenshotTheme === "light" || screenshotTheme === "dark") {
    await page.emulateMedia({ colorScheme: screenshotTheme });
  }
  const url = baseUrl + path;
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push("console:" + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror:" + e.message));
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => errors.push("goto:" + e.message));
  // settle fonts/images/animations
  await page.waitForTimeout(800);
  const name = `${label}-${path.replace(/[^\w]/g, "_")}-${w}x${h}.png`;
  const file = join(root, name);
  await page.screenshot({ path: file, fullPage: false });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  results.push({ file, url, viewport: `${w}x${h}`, overflow, errors });
  await page.close();
}
await browser.close();
for (const r of results) {
  console.log(JSON.stringify(r));
}
