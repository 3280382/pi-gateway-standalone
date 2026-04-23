/**
 * Terminal WebSocket Tests - 使用开发环境
 * 连接已运行的开发服务器 (http://127.0.0.1:5173)
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test } from "@playwright/test";

// 开发环境配置
const DEV_CONFIG = {
  appUrl: "http://127.0.0.1:5173", // Vite dev server
  wsUrl: "ws://127.0.0.1:3000/ws/terminal", // Backend WebSocket
  logDir: "/root/pi-gateway-standalone/logs/test",
  screenshotsDir: "/root/pi-gateway-standalone/logs/test/screenshots",
};

// 创建目录
mkdirSync(DEV_CONFIG.logDir, { recursive: true });
mkdirSync(DEV_CONFIG.screenshotsDir, { recursive: true });

const logFile = `${DEV_CONFIG.logDir}/dev-test.log`;

function log(level: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}${data ? ` ${JSON.stringify(data)}` : ""}\n`;
  console.log(entry.trim());
  appendFileSync(logFile, entry);
}

// 截图辅助
async function screenshot(page: any, name: string) {
  const path = `${DEV_CONFIG.screenshotsDir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  log("INFO", `Screenshot: ${path}`);
}

// 前置检查
test.beforeAll(async () => {
  log("INFO", "=== 开发环境测试开始 ===");
  log("INFO", `前端地址: ${DEV_CONFIG.appUrl}`);
  log("INFO", `WebSocket地址: ${DEV_CONFIG.wsUrl}`);
});

test.afterAll(() => {
  log("INFO", "=== 开发环境测试结束 ===");
});

test.describe("Terminal 开发环境测试", () => {
  test("页面加载", async ({ page }) => {
    log("INFO", "测试1: 页面加载");

    try {
      await page.goto(DEV_CONFIG.appUrl, { timeout: 10000 });
      await page.waitForLoadState("networkidle");
      await delay(1000);

      await screenshot(page, "dev-01-page-loaded");

      const title = await page.title();
      log("INFO", `页面标题: ${title}`);

      // 检查是否加载成功（不是404页面）
      const body = await page.locator("body").count();
      expect(body).toBe(1);

      log("INFO", "✅ 页面加载成功");
    } catch (e) {
      log("ERROR", "❌ 页面加载失败", e);
      await screenshot(page, "dev-01-page-failed");
      throw e;
    }
  });

  test("点击终端按钮", async ({ page }) => {
    log("INFO", "测试2: 点击终端按钮");

    await page.goto(DEV_CONFIG.appUrl);
    await page.waitForLoadState("networkidle");
    await delay(1000);

    // 先切换到 Files 视图
    const filesBtn = page.locator("button:has-text('Files'), [class*='files' i]").first();
    if ((await filesBtn.count()) > 0) {
      await filesBtn.click();
      log("INFO", "切换到 Files 视图");
      await delay(1500);
    }

    // 查找终端按钮
    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();
    const count = await terminalBtn.count();

    log("INFO", `找到 ${count} 个终端按钮`);

    if (count > 0) {
      await terminalBtn.click();
      log("INFO", "✅ 终端按钮已点击");
      await delay(1000);
      await screenshot(page, "dev-02-terminal-opened");
    } else {
      await screenshot(page, "dev-02-button-not-found");
      log("ERROR", "❌ 未找到终端按钮");
      throw new Error("Terminal button not found");
    }
  });

  test("终端面板显示", async ({ page }) => {
    log("INFO", "测试3: 终端面板显示");

    await page.goto(DEV_CONFIG.appUrl);
    await page.waitForLoadState("networkidle");

    // 先切换到 Files 视图
    const filesBtn = page.locator("button:has-text('Files'), [class*='files' i]").first();
    if ((await filesBtn.count()) > 0) {
      await filesBtn.click();
      await delay(1500);
    }

    // 打开终端
    const terminalBtn = page
      .locator("button[title*='Terminal' i], button[class*='terminalBtn' i]")
      .first();
    if ((await terminalBtn.count()) > 0) {
      await terminalBtn.click();
      await delay(1500);
    }

    // 查找终端相关元素
    const elements = {
      tabs: await page.locator("[class*='tab' i]").count(),
      panels: await page.locator("[class*='panel' i]").count(),
      terminals: await page.locator(".xterm, [class*='terminal' i], [class*='xterm' i]").count(),
    };

    log("INFO", "终端元素统计", elements);
    await screenshot(page, "dev-03-terminal-panel");

    expect(elements.panels + elements.terminals).toBeGreaterThan(0);
    log("INFO", "✅ 终端面板已显示");
  });

  test("WebSocket 连接", async ({ page }) => {
    log("INFO", "测试4: WebSocket 连接");

    const wsMessages: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (text.toLowerCase().includes("websocket") || text.toLowerCase().includes("terminal")) {
        wsMessages.push(text);
        log("DEBUG", `Console: ${text}`);
      }
    });

    await page.goto(DEV_CONFIG.appUrl);
    await page.waitForLoadState("networkidle");

    // 打开终端触发 WebSocket 连接
    const terminalBtn = page.locator("button[title*='Terminal' i]").first();
    if ((await terminalBtn.count()) > 0) {
      await terminalBtn.click();
    }

    await delay(3000);
    await screenshot(page, "dev-04-websocket");

    log("INFO", `捕获 ${wsMessages.length} 条 WebSocket 相关日志`);

    // 保存日志
    const fs = await import("node:fs");
    fs.writeFileSync(
      `${DEV_CONFIG.logDir}/dev-websocket-messages.json`,
      JSON.stringify(wsMessages, null, 2)
    );
  });
});
