const fs = require("node:fs");
const { chromium } = require("playwright");

async function main() {
  const source = fs.readFileSync("app/page.tsx", "utf8");
  const buttons = [...source.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
  const withoutHandler = buttons
    .filter((match) => !match[1].includes("onClick") && !match[1].includes('type="submit"'))
    .map((match) => match[2].replace(/<[^>]+>/g, " ").replace(/\{[^}]+\}/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => message.type() === "error" && errors.push(`console: ${message.text()}`));
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  await page.goto(process.env.UI_AUDIT_URL || "http://127.0.0.1:3000", { waitUntil: "networkidle", timeout: 30000 });
  const navigation = {};
  const navButtons = page.locator("aside.sidebar nav button");
  for (let index = 0; index < await navButtons.count(); index += 1) {
    await navButtons.nth(index).click({ force: true });
    await page.waitForTimeout(250);
    navigation[index] = await page.locator("header h1").textContent();
  }
  await page.goto(process.env.UI_AUDIT_URL || "http://127.0.0.1:3000", { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("aside.sidebar nav button").nth(1).click({ force: true });
  await page.locator(".news-item").first().waitFor({ timeout: 10000 });
  const newsItems = await page.locator(".news-item").count();
  await page.locator(".search-pill").click({ force: true });
  const toast = page.locator(".toast");
  const fallbackFeedback = (await toast.count()) > 0 ? await toast.first().textContent() : null;
  await page.goto(process.env.UI_AUDIT_URL || "http://127.0.0.1:3000", { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("aside.sidebar nav button").nth(3).click({ force: true });
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count()) await submit.click({ force: true });
  await page.waitForTimeout(1500);
  const generated = await page.locator(".editor-preview").count();
  await page.goto(process.env.UI_AUDIT_URL || "http://127.0.0.1:3000", { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("aside.sidebar nav button").nth(4).click({ force: true });
  const tabs = {};
  const publishButtons = page.locator(".publish-tabs button");
  for (let index = 0; index < await publishButtons.count(); index += 1) {
    const button = publishButtons.nth(index);
    await button.click({ force: true });
    tabs[index] = await button.evaluate((element) => element.classList.contains("active"));
  }
  await page.goto(process.env.UI_AUDIT_URL || "http://127.0.0.1:3000", { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("aside.sidebar nav button").nth(5).click({ force: true });
  const settings = {};
  const settingsButtons = page.locator(".settings-nav button");
  for (let index = 0; index < await settingsButtons.count(); index += 1) {
    await settingsButtons.nth(index).click({ force: true });
    settings[index] = await page.locator(".settings-main h3").first().textContent();
  }
  await browser.close();
  console.log(JSON.stringify({ static: { totalButtons: buttons.length, withoutHandler }, navigation, newsItems, fallbackFeedback, generated: generated > 0, tabs, settings, errors }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
