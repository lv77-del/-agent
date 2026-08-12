const fs = require("node:fs");
const { chromium } = require("playwright");

async function main() {
  const source = fs.readFileSync("app/page.tsx", "utf8");
  const buttons = [...source.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
  const withoutHandler = buttons
    .filter((match) => !match[1].includes("onClick") && !match[1].includes("type=\"submit\""))
    .map((match) => match[2].replace(/<[^>]+>/g, " ").replace(/\{[^}]+\}/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => message.type() === "error" && errors.push(`console: ${message.text()}`));
  page.on("requestfailed", (request) => errors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle", timeout: 30000 });

  const navigation = {};
  for (const label of ["工作台", "资讯采集", "选题分析", "内容创作", "发布管理", "系统设置"]) {
    await page.getByRole("button", { name: label, exact: false }).first().click();
    await page.waitForTimeout(250);
    navigation[label] = await page.locator("header h1").textContent();
  }

  await page.getByRole("button", { name: "资讯采集", exact: true }).click();
  await page.locator(".news-item").first().waitFor({ timeout: 10000 });
  const newsItems = await page.locator(".news-item").count();
  await page.locator(".search-pill").click();
  const fallbackFeedback = await page.locator(".toast").textContent();

  await page.getByRole("button", { name: "内容创作", exact: true }).click();
  await page.getByRole("button", { name: "生成完整文章", exact: true }).click();
  await page.waitForTimeout(1500);
  const generated = await page.getByText("普通人如何搭建自己的第一支", { exact: false }).count();

  await page.getByRole("button", { name: "发布管理", exact: false }).first().click();
  const tabs = {};
  for (const label of ["草稿", "待审核", "待发布", "已发布", "发布失败"]) {
    const button = page.locator(".publish-tabs button", { hasText: label });
    await button.click();
    tabs[label] = await button.evaluate((element) => element.classList.contains("active"));
  }

  await page.getByRole("button", { name: "系统设置", exact: true }).click();
  const settings = {};
  for (const label of ["AI 模型", "内容采集 API", "发布渠道", "Unsplash 图片", "通用设置"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    settings[label] = await page.locator(".settings-main h3").first().textContent();
  }

  await browser.close();
  console.log(JSON.stringify({ static: { totalButtons: buttons.length, withoutHandler }, navigation, newsItems, fallbackFeedback, generated: generated > 0, tabs, settings, errors }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
