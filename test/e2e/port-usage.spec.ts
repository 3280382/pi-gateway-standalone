/**
 * Port Usage E2E Tests
 * Verify the port usage viewer modal works correctly
 */

import { expect, test } from "@playwright/test";
import { BrowserTestHelper, TestLogger, TestServerManager } from "../lib/test-utils.js";

const logger = new TestLogger("e2e-port-usage");
const browserHelper = new BrowserTestHelper("e2e-port-usage");

const server = new TestServerManager();
const appUrl = "http://127.0.0.1:5173";

test.beforeAll(async () => {
  logger.info("Initializing port usage E2E tests");
  await server.start();
});

test.afterAll(() => {
  server.stop();
  logger.info("Port usage E2E tests completed");
});

test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    browserHelper.logConsole(msg.type(), msg.text());
  });
});

test("port usage menu item is visible in tool menu", async ({ page }) => {
  logger.info("Test: Port Usage menu item visible");

  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  // Hide Eruda if present
  await page.evaluate(() => {
    const eruda = document.getElementById("eruda");
    if (eruda) eruda.style.display = "none";
  });

  // Click the tools menu button in footer
  const toolsButton = page.locator("button[title='Tools']").first();
  await expect(toolsButton).toBeVisible();
  await toolsButton.click({ force: true });

  // Wait for menu to open and check Port Usage item
  const portUsageItem = page.locator("button:has-text('Port Usage')").first();
  await expect(portUsageItem).toBeVisible();

  await page.screenshot({
    path: browserHelper.getScreenshotPath("port-usage-menu-item"),
    fullPage: true,
  });

  logger.info("Port Usage menu item is visible");
});

test("port usage modal opens", async ({ page }) => {
  logger.info("Test: Port Usage modal opens");

  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);

  // Hide Eruda if present
  await page.evaluate(() => {
    const eruda = document.getElementById("eruda");
    if (eruda) eruda.style.display = "none";
  });

  // Open tools menu
  const toolsButton = page.locator("button[title='Tools']").first();
  await toolsButton.click({ force: true });

  // Click Port Usage
  const portUsageItem = page.locator("button:has-text('Port Usage')").first();
  await portUsageItem.click({ force: true });

  // Wait for modal to appear
  const modalTitle = page.locator("text=Port Usage").first();
  await expect(modalTitle).toBeVisible();

  await page.waitForTimeout(2000);

  // Take screenshot of modal
  await page.screenshot({
    path: browserHelper.getScreenshotPath("port-usage-modal"),
    fullPage: true,
  });

  logger.info("Port Usage modal opened");
});
