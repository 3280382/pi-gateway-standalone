import { appendFileSync, mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const RESULTS_DIR = process.env.TEST_RESULTS_DIR || "logs/test";
mkdirSync(`${RESULTS_DIR}/browser`, { recursive: true });

const LOG_FILE = `${RESULTS_DIR}/browser/session-switch-test.log`;

function log(level: string, message: string) {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  console.log(entry.trim());
  appendFileSync(LOG_FILE, entry);
}

test("切换 session 时消息应该正确加载", async ({ page }) => {
  log("INFO", "开始测试: 切换 session 消息加载");

  // 捕获控制台日志
  page.on("console", (msg) => {
    log("CONSOLE", `[${msg.type()}] ${msg.text()}`);
  });

  // 捕获 WebSocket 消息
  const wsMessages: any[] = [];
  page.on("websocket", (ws) => {
    ws.on("framereceived", (data) => {
      try {
        const parsed = JSON.parse(data.payload as string);
        wsMessages.push({ type: "received", data: parsed, time: Date.now() });
        log("WS", `<- ${parsed.type}`);

        if (parsed.type === "session_loaded") {
          log(
            "INFO",
            `session_loaded 收到: messages=${parsed.messages?.length}, shortId=${parsed.shortId}`
          );
        }
      } catch (_e) {
        // ignore
      }
    });

    ws.on("framesent", (data) => {
      try {
        const parsed = JSON.parse(data.payload as string);
        log("WS", `-> ${parsed.type}`);
      } catch (_e) {
        // ignore
      }
    });
  });

  // 1. 打开页面并等待初始化
  await page.goto("/");
  await page.waitForTimeout(3000);
  log("INFO", "页面加载完成");

  // 2. 打开侧边栏
  const sidebarToggle = await page.locator('[data-testid="sidebar-toggle"]').first();
  if (await sidebarToggle.isVisible().catch(() => false)) {
    await sidebarToggle.click();
    log("INFO", "打开侧边栏");
    await page.waitForTimeout(1000);
  }

  // 3. 获取当前 session ID
  const currentSessionId = await page.evaluate(() => {
    // @ts-expect-error
    return window.__SESSION_ID__ || localStorage.getItem("currentSessionId") || "unknown";
  });
  log("INFO", `当前 session ID: ${currentSessionId}`);

  // 4. 获取 session 列表
  const sessionRows = await page.locator("[data-session-id]").all();
  log("INFO", `找到 ${sessionRows.length} 个 session`);

  if (sessionRows.length < 2) {
    log("WARN", "session 数量不足，跳过测试");
    return;
  }

  // 5. 记录切换前的消息数量
  const messagesBefore = await page.locator(".message-item, [data-message-id]").count();
  log("INFO", `切换前消息数量: ${messagesBefore}`);

  // 6. 点击第二个 session
  const secondSession = sessionRows[1];
  const targetSessionId = await secondSession.getAttribute("data-session-id");
  log("INFO", `点击切换到 session: ${targetSessionId}`);

  await secondSession.click();
  await page.waitForTimeout(2000);

  // 7. 检查 session_loaded 消息
  const sessionLoadedMsgs = wsMessages.filter((m) => m.data.type === "session_loaded");
  log("INFO", `收到 ${sessionLoadedMsgs.length} 个 session_loaded 消息`);

  if (sessionLoadedMsgs.length > 0) {
    const lastMsg = sessionLoadedMsgs[sessionLoadedMsgs.length - 1].data;
    log(
      "INFO",
      `session_loaded 内容: shortId=${lastMsg.shortId}, messages=${lastMsg.messages?.length}`
    );

    // 验证消息是否正确
    expect(lastMsg.success).toBe(true);
    expect(lastMsg.shortId).toBeDefined();

    if (lastMsg.messages && lastMsg.messages.length > 0) {
      log("INFO", `✅ 消息加载成功: ${lastMsg.messages.length} 条`);
    } else {
      log("ERROR", `❌ 消息加载失败: messages 为空或不存在`);
    }
  } else {
    log("ERROR", "❌ 未收到 session_loaded 消息");
  }

  // 8. 检查页面上的消息
  const messagesAfter = await page.locator(".message-item, [data-message-id]").count();
  log("INFO", `切换后消息数量: ${messagesAfter}`);

  // 截图
  await page.screenshot({
    path: `${RESULTS_DIR}/screenshots/session-switch-result.png`,
    fullPage: true,
  });

  log("INFO", "测试完成");
});
