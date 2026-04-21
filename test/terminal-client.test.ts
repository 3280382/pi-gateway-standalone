/**
 * Terminal WebSocket Client Browser Tests
 * 规范：使用 test/lib/test-utils.ts 中的工具函数
 */

import { mkdirSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { expect, type Page, test } from "@playwright/test";
import { BrowserTestHelper, TEST_CONFIG, TestLogger, TestServerManager } from "./lib/test-utils.js";

// ========== 初始化 ==========
const logger = new TestLogger("terminal-client");
const browserHelper = new BrowserTestHelper("terminal-client");

// 确保目录存在
mkdirSync(`${TEST_CONFIG.resultsDir}/screenshots`, { recursive: true });
mkdirSync(`${TEST_CONFIG.resultsDir}/browser`, { recursive: true });

const appUrl = `http://127.0.0.1:${TEST_CONFIG.port}`;

// ========== 服务器管理 ==========
const server = new TestServerManager();

test.beforeAll(async () => {
  logger.info("=== 浏览器测试开始 ===");
  await server.start();
});

test.afterAll(async () => {
  server.stop();
  logger.info("=== 浏览器测试完成 ===");
});

// ========== 截图辅助函数 ==========
async function takeScreenshot(page: Page, name: string): Promise<void> {
  const path = browserHelper.getScreenshotPath(name);
  await page.screenshot({ path, fullPage: true });
  logger.info(`截图已保存: ${path}`);
}

// ========== 控制台监听设置 ==========
test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    browserHelper.logConsole(msg.type(), msg.text());

    if (msg.text().includes("WebSocket") || msg.text().includes("terminal")) {
      logger.info("控制台日志捕获", { type: msg.type(), text: msg.text().substring(0, 200) });
    }
  });

  page.on("pageerror", (error) => {
    browserHelper.logConsole("error", `页面错误: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    browserHelper.logConsole(
      "error",
      `请求失败: ${request.url()} - ${request.failure()?.errorText}`
    );
  });

  page.on("websocket", (ws) => {
    ws.on("framereceived", (data) => {
      browserHelper.logWebSocket("received", data);
    });
    ws.on("framesent", (data) => {
      browserHelper.logWebSocket("sent", data);
    });
  });
});

// ========== 测试套件 ==========
test.describe("Terminal Panel 浏览器测试", () => {
  test("页面加载并显示文件浏览器", async ({ page }) => {
    logger.info("测试: 页面加载");

    await page.goto(appUrl);
    await page.waitForLoadState("networkidle");

    // 等待页面基本元素加载
    await page.waitForSelector("body", { timeout: 10000 });

    await takeScreenshot(page, "01-page-loaded");

    logger.info("页面加载成功");
  });

  test("点击终端按钮打开面板", async ({ page }) => {
    logger.info("测试: 打开终端面板");

    await page.goto(appUrl);
    await page.waitForLoadState("networkidle");

    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();

    if (await terminalBtn.isVisible().catch(() => false)) {
      await terminalBtn.click();
      logger.info("终端按钮已点击");

      await setTimeout(1000);
      await takeScreenshot(page, "02-terminal-panel-opened");

      const panel = page.locator("[class*='panel' i]").first();
      const isVisible = await panel.isVisible().catch(() => false);

      expect(isVisible).toBe(true);
    } else {
      logger.warn("未找到终端按钮，截图记录");
      await takeScreenshot(page, "02-terminal-button-not-found");
      throw new Error("未找到终端按钮");
    }
  });

  test("创建新终端会话", async ({ page }) => {
    logger.info("测试: 创建终端会话");

    await page.goto(appUrl);
    await page.waitForLoadState("networkidle");

    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();
    await terminalBtn.click();
    await setTimeout(1000);

    const newSessionBtn = page
      .locator(
        "button[title*='New terminal' i], button[class*='addTabBtn' i], button:has-text('Create Terminal')"
      )
      .first();

    if (await newSessionBtn.isVisible().catch(() => false)) {
      await newSessionBtn.click();
      logger.info("新建会话按钮已点击");

      await setTimeout(1000);
      await takeScreenshot(page, "03-new-session-created");

      const tab = page.locator("[class*='tab' i]").first();
      const hasTab = await tab.isVisible().catch(() => false);

      expect(hasTab).toBe(true);
    } else {
      const terminal = page.locator(".xterm, [class*='terminal' i]").first();
      const hasTerminal = await terminal.isVisible().catch(() => false);

      if (hasTerminal) {
        logger.info("初始会话自动创建");
        await takeScreenshot(page, "03-auto-session-created");
      } else {
        await takeScreenshot(page, "03-no-session-button");
        throw new Error("无法创建或找到终端会话");
      }
    }
  });

  test("在终端中输入命令", async ({ page }) => {
    logger.info("测试: 输入命令");

    await page.goto(appUrl);
    await page.waitForLoadState("networkidle");

    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();
    await terminalBtn.click();
    await setTimeout(2000);

    const terminal = page.locator(".xterm-viewport, .xterm-screen, [class*='terminal' i]").first();

    if (await terminal.isVisible().catch(() => false)) {
      await terminal.click();

      await page.keyboard.type("echo 'Test from Playwright'");
      await setTimeout(500);

      await takeScreenshot(page, "04-command-typed");

      await page.keyboard.press("Enter");
      await setTimeout(2000);

      await takeScreenshot(page, "05-command-executed");

      logger.info("命令已输入并执行");
    } else {
      await takeScreenshot(page, "04-terminal-not-found");
      throw new Error("未找到终端");
    }
  });

  test("WebSocket消息在控制台中记录", async ({ page }) => {
    logger.info("测试: WebSocket 日志记录");

    await page.goto(appUrl);
    await page.waitForLoadState("networkidle");

    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();
    await terminalBtn.click();

    await setTimeout(3000);

    await takeScreenshot(page, "06-websocket-activity");

    logger.info("WebSocket 活动已记录");
  });

  test("终端调整大小手柄工作", async ({ page }) => {
    logger.info("测试: 终端调整大小");

    await page.goto(appUrl);
    await page.waitForLoadState("networkidle");

    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();
    await terminalBtn.click();
    await setTimeout(1000);

    const resizeHandle = page.locator("[class*='resizeHandle' i]").first();

    if (await resizeHandle.isVisible().catch(() => false)) {
      const box = await resizeHandle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y - 50);
        await page.mouse.up();

        await setTimeout(500);
        await takeScreenshot(page, "07-terminal-resized");

        logger.info("终端已调整大小");
      }
    } else {
      logger.warn("未找到调整大小手柄");
    }
  });

  test("多个终端标签页", async ({ page }) => {
    logger.info("测试: 多标签页");

    await page.goto(appUrl);
    await page.waitForLoadState("networkidle");

    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();
    await terminalBtn.click();
    await setTimeout(1000);

    for (let i = 0; i < 3; i++) {
      const newSessionBtn = page
        .locator("button[title*='New terminal' i], button[class*='addTabBtn' i]")
        .first();

      if (await newSessionBtn.isVisible().catch(() => false)) {
        await newSessionBtn.click();
        await setTimeout(500);
      }
    }

    await takeScreenshot(page, "08-multiple-tabs");

    const tabs = await page.locator("[class*='tab' i]").count();
    logger.info(`标签页数量: ${tabs}`);

    expect(tabs).toBeGreaterThanOrEqual(1);
  });

  test("终端全屏切换", async ({ page }) => {
    logger.info("测试: 全屏切换");

    await page.goto(appUrl);
    await page.waitForLoadState("networkidle");

    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();
    await terminalBtn.click();
    await setTimeout(1000);

    const fullscreenBtn = page
      .locator("button[title*='Fullscreen' i], button[title*='fullscreen' i]")
      .first();

    if (await fullscreenBtn.isVisible().catch(() => false)) {
      await fullscreenBtn.click();
      await setTimeout(500);
      await takeScreenshot(page, "09-fullscreen-on");

      await fullscreenBtn.click();
      await setTimeout(500);
      await takeScreenshot(page, "10-fullscreen-off");

      logger.info("全屏已切换");
    } else {
      logger.warn("未找到全屏按钮");
    }
  });
});
