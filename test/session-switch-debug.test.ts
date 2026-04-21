import { appendFileSync, mkdirSync } from "node:fs";
import { test } from "@playwright/test";

const RESULTS_DIR = process.env.TEST_RESULTS_DIR || "test-results/latest";
mkdirSync(`${RESULTS_DIR}/browser`, { recursive: true });

const LOG_FILE = `${RESULTS_DIR}/browser/session-switch-debug.log`;

function log(level: string, message: string) {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  console.log(entry.trim());
  appendFileSync(LOG_FILE, entry);
}

test("调试切换 session 消息加载", async ({ page }) => {
  log("INFO", "开始测试: 调试切换 session 消息加载");

  // 捕获所有控制台日志
  page.on("console", (msg) => {
    const text = msg.text();
    log("CONSOLE", `[${msg.type()}] ${text}`);
  });

  // 1. 打开页面
  await page.goto("http://127.0.0.1:3000/");
  await page.waitForTimeout(5000);
  log("INFO", "页面加载完成");

  // 2. 点击 Chat 按钮打开 sidebar
  const chatButton = page.locator('button:has-text("Chat")').first();
  if (await chatButton.isVisible().catch(() => false)) {
    await chatButton.click();
    log("INFO", "点击 Chat 按钮");
    await page.waitForTimeout(2000);
  }

  // 3. 获取当前消息数量
  const messagesBefore = await page.locator('[class*="user"], [class*="ai"]').count();
  log("IMPORTANT", `切换前消息数量: ${messagesBefore}`);

  // 4. 找到并点击第二个 session
  const sessionRows = page.locator("table tbody tr");
  const rowCount = await sessionRows.count();
  log("IMPORTANT", `找到 ${rowCount} 个 table rows`);

  if (rowCount < 2) {
    log("WARN", "session 数量不足");
    return;
  }

  // 点击第二个 session - 直接调用 sessionManager.selectSession
  // 先获取第二个 session 的 ID
  const secondSessionId = await page.evaluate(() => {
    // 从 DOM 中获取 session ID
    const rows = document.querySelectorAll("table tbody tr");
    if (rows.length > 1) {
      const secondRow = rows[1];
      // 尝试获取 data-session-id 属性
      const sessionId = secondRow.getAttribute("data-session-id");
      if (sessionId) return sessionId;

      // 否则从文本中提取
      const text = secondRow.textContent || "";
      const match = text.match(/^[a-f0-9]+/);
      return match ? match[0] : null;
    }
    return null;
  });

  log("IMPORTANT", `第二个 session ID: ${secondSessionId}`);

  // 监听新的 initialized 消息
  let initializedReceived = false;
  let newMessageCount = 0;
  const checkInitialized = (msg: any) => {
    const text = msg.text();
    if (text.includes("Messages from server:")) {
      const match = text.match(/Messages from server:\s*(\d+)/);
      if (match) {
        newMessageCount = parseInt(match[1], 10);
        log("IMPORTANT", `切换后收到 initialized，消息数: ${newMessageCount}`);
        initializedReceived = true;
      }
    }
  };
  page.on("console", checkInitialized);

  // 使用 exposeFunction 来调用 sessionManager
  await page.evaluate((id) => {
    // 触发一个自定义事件，让应用处理
    window.dispatchEvent(new CustomEvent("test-select-session", { detail: id }));
  }, secondSessionId);

  log("IMPORTANT", "已发送 test-select-session 事件");

  // 5. 等待一段时间让消息加载
  await page.waitForTimeout(8000);

  page.off("console", checkInitialized);

  if (!initializedReceived) {
    log("WARN", "切换后没有收到新的 initialized 消息");
  }

  // 6. 获取切换后的消息数量
  const messagesAfter = await page.locator('[class*="user"], [class*="ai"]').count();
  log("IMPORTANT", `切换后消息数量: ${messagesAfter}`);

  // 截图
  await page.screenshot({
    path: `${RESULTS_DIR}/screenshots/session-switch-debug-result.png`,
    fullPage: true,
  });

  log("INFO", "测试完成");
});
