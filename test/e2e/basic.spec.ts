/**
 * Basic E2E Tests
 */

import { test, expect } from "@playwright/test";
import {
  TEST_CONFIG,
  TestLogger,
  BrowserTestHelper,
  TestServerManager,
} from "../lib/test-utils.js";
import { mkdirSync } from "node:fs";

const logger = new TestLogger("e2e-basic");
const browserHelper = new BrowserTestHelper("e2e-basic");

// 确保目录存在
mkdirSync(`${TEST_CONFIG.resultsDir}/screenshots`, { recursive: true });
mkdirSync(`${TEST_CONFIG.resultsDir}/browser`, { recursive: true });

const server = new TestServerManager();
const appUrl = `http://127.0.0.1:${TEST_CONFIG.port}`;

test.beforeAll(async () => {
  logger.info("初始化 E2E 基础测试");
  await server.start();
});

test.afterAll(() => {
  server.stop();
  logger.info("E2E 基础测试完成");
});

test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    browserHelper.logConsole(msg.type(), msg.text());
  });
});

test("page loads successfully", async ({ page }) => {
  logger.info("测试: 页面加载");
  
  await page.goto(appUrl);
  await page.waitForLoadState("networkidle");
  
  // 截图
  await page.screenshot({
    path: browserHelper.getScreenshotPath("e2e-01-page-loads"),
    fullPage: true,
  });
  
  // 验证页面标题或关键元素
  const title = await page.title();
  logger.info("页面标题", { title });
  
  expect(title).toBeTruthy();
});

test("file browser is visible", async ({ page }) => {
  logger.info("测试: 文件浏览器可见");
  
  await page.goto(appUrl);
  await page.waitForLoadState("networkidle");
  
  // 查找文件浏览器
  const fileBrowser = page.locator("[data-testid='file-browser']").first();
  const isVisible = await fileBrowser.isVisible().catch(() => false);
  
  if (isVisible) {
    logger.info("文件浏览器可见");
  } else {
    logger.warn("文件浏览器不可见");
  }
  
  await page.screenshot({
    path: browserHelper.getScreenshotPath("e2e-02-file-browser"),
    fullPage: true,
  });
  
  expect(isVisible).toBe(true);
});

test("navigation works", async ({ page }) => {
  logger.info("测试: 导航功能");
  
  await page.goto(appUrl);
  await page.waitForLoadState("networkidle");
  
  // 截图初始状态
  await page.screenshot({
    path: browserHelper.getScreenshotPath("e2e-03-navigation"),
    fullPage: true,
  });
  
  logger.info("导航测试完成");
});
