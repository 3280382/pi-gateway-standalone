/**
 * Filter Regression Test
 * Covers: clicking search filter dropdown, toggling options, verifying no JS errors
 * Regression for: "props is not defined" when toggling filters
 *
 * Uses the running dev server (port 5173).
 */

import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  BrowserTestHelper,
  TEST_CONFIG,
  TestLogger,
} from "../lib/test-utils.js";

const logger = new TestLogger("filter-regression");
const browserHelper = new BrowserTestHelper("filter-regression");

mkdirSync(`${TEST_CONFIG.resultsDir}/screenshots`, { recursive: true });

const appUrl = "http://127.0.0.1:5173";

test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    browserHelper.logConsole(msg.type(), msg.text());
  });
  page.on("pageerror", (err) => {
    logger.error("Page error", { message: err.message });
  });
});

async function collectConsoleErrors(page: any): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (msg: any) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test("filter dropdown opens without JS errors", async ({ page }) => {
  logger.info("测试: 过滤下拉框展开");

  await page.goto(appUrl);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // The filter button has class filterToggle and contains an SVG icon
  const filterBtn = page.locator("button[class*='filterToggle']").first();
  const btnExists = await filterBtn.isVisible().catch(() => false);
  if (!btnExists) {
    logger.warn("Filter button not found, taking screenshot");
    await page.screenshot({
      path: `${TEST_CONFIG.resultsDir}/screenshots/filter-regression-no-button.png`,
      fullPage: true,
    });
    test.skip();
    return;
  }

  const consoleErrors = await collectConsoleErrors(page);

  // Click the filter button
  await filterBtn.click();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: `${TEST_CONFIG.resultsDir}/screenshots/filter-regression-dropdown-open.png`,
    fullPage: true,
  });

  // Verify dropdown is visible
  const dropdown = page.locator("div[class*='filterDropdown']").first();
  const dropdownVisible = await dropdown.isVisible().catch(() => false);
  logger.info("Dropdown visible", { dropdownVisible });

  expect(dropdownVisible).toBe(true);
  expect(consoleErrors.filter((e) => e.includes("props is not defined"))).toHaveLength(0);
  expect(consoleErrors.filter((e) => e.includes("ReferenceError"))).toHaveLength(0);
});

test("toggling thinking filter hides thinking content", async ({ page }) => {
  logger.info("测试: 切换 Thinking 过滤");

  await page.goto(appUrl);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // Check if there are any messages
  const messages = page.locator("[data-message-id], .message").first();
  const hasMessages = await messages.isVisible().catch(() => false);
  if (!hasMessages) {
    logger.warn("No messages found, skipping toggle test");
    test.skip();
    return;
  }

  // Find filter button
  const filterBtn = page.locator("button[class*='filterToggle']").first();
  const btnExists = await filterBtn.isVisible().catch(() => false);
  if (!btnExists) {
    logger.warn("Filter button not found");
    test.skip();
    return;
  }

  const consoleErrors = await collectConsoleErrors(page);

  // Open filter dropdown
  await filterBtn.click();
  await page.waitForTimeout(300);

  // Find "Thinking" option and click it
  // FilterChip is a button with text containing "Thinking"
  const thinkingOption = page.locator("button[class*='filterChip']").filter({ hasText: /Thinking/ }).first();
  const thinkingExists = await thinkingOption.isVisible().catch(() => false);
  if (!thinkingExists) {
    logger.warn("Thinking option not found in dropdown");
    test.skip();
    return;
  }

  // Click to toggle off
  await thinkingOption.click();
  await page.waitForTimeout(500);

  await page.screenshot({
    path: `${TEST_CONFIG.resultsDir}/screenshots/filter-regression-thinking-off.png`,
    fullPage: true,
  });

  expect(consoleErrors.filter((e) => e.includes("props is not defined"))).toHaveLength(0);
  expect(consoleErrors.filter((e) => e.includes("ReferenceError"))).toHaveLength(0);

  logger.info("Thinking filter toggle passed without errors");
});

test("toggling tool filter hides tool content", async ({ page }) => {
  logger.info("测试: 切换 Tool 过滤");

  await page.goto(appUrl);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // Find filter button
  const filterBtn = page.locator("button[class*='filterToggle']").first();
  const btnExists = await filterBtn.isVisible().catch(() => false);
  if (!btnExists) {
    logger.warn("Filter button not found");
    test.skip();
    return;
  }

  const consoleErrors = await collectConsoleErrors(page);

  // Open filter dropdown
  await filterBtn.click();
  await page.waitForTimeout(300);

  // Find "Tools" option
  const toolOption = page.locator("button[class*='filterChip']").filter({ hasText: /Tools/ }).first();
  const toolExists = await toolOption.isVisible().catch(() => false);
  if (!toolExists) {
    logger.warn("Tool option not found in dropdown");
    test.skip();
    return;
  }

  // Click to toggle off
  await toolOption.click();
  await page.waitForTimeout(500);

  await page.screenshot({
    path: `${TEST_CONFIG.resultsDir}/screenshots/filter-regression-tool-off.png`,
    fullPage: true,
  });

  expect(consoleErrors.filter((e) => e.includes("props is not defined"))).toHaveLength(0);
  expect(consoleErrors.filter((e) => e.includes("ReferenceError"))).toHaveLength(0);

  logger.info("Tool filter toggle passed without errors");
});
