/**
 * Terminal WebSocket Server Tests
 * 规范：使用 test/lib/test-utils.ts 中的工具函数
 */

import { setTimeout as delay } from "node:timers/promises";
import {
  TEST_CONFIG,
  TestLogger,
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
} from "./lib/test-utils.js";

// ========== 初始化 ==========
const logger = new TestLogger("terminal-server");
const reporter = new TestReporter("terminal-server");
const testState: { sessionId?: string } = {};

// ========== 测试用例 ==========
async function runTests(): Promise<void> {
  const server = new TestServerManager();

  try {
    // 启动服务器
    await server.start();
    await delay(2000);

    // 测试 1: WebSocket 连接
    await reporter.runTest("WebSocket 连接", async () => {
      const client = new TestWebSocketClient(TEST_CONFIG.resultsDir);
      await client.connect(`ws://127.0.0.1:${TEST_CONFIG.port}/ws/terminal`);

      const welcomeMsg = await client.waitForMessage((m) => m.type === "terminal_connected");

      if (!welcomeMsg.connectionId) {
        throw new Error("欢迎消息中没有 connectionId");
      }

      client.disconnect();
    });

    // 测试 2: 创建终端会话
    await reporter.runTest("创建终端会话", async () => {
      const client = new TestWebSocketClient(TEST_CONFIG.resultsDir);
      await client.connect(`ws://127.0.0.1:${TEST_CONFIG.port}/ws/terminal`);
      await client.waitForMessage((m) => m.type === "terminal_connected");

      client.send("terminal_create", {
        name: "Test Terminal",
        workingDir: "/root",
        cols: 80,
        rows: 24,
      });

      const createdMsg = await client.waitForMessage((m) => m.type === "terminal_created");

      if (!createdMsg.sessionId) {
        throw new Error("创建消息中没有 sessionId");
      }

      testState.sessionId = createdMsg.sessionId as string;

      client.disconnect();
    });

    // 测试 3: 执行命令
    await reporter.runTest("执行命令", async () => {
      const client = new TestWebSocketClient(TEST_CONFIG.resultsDir);
      await client.connect(`ws://127.0.0.1:${TEST_CONFIG.port}/ws/terminal`);
      await client.waitForMessage((m) => m.type === "terminal_connected");

      // 先创建会话
      client.send("terminal_create", { name: "Cmd Test", workingDir: "/root" });
      const created = await client.waitForMessage((m) => m.type === "terminal_created");
      const sessionId = created.sessionId as string;

      // 执行 echo 命令
      client.send("terminal_execute", {
        sessionId,
        command: "echo 'Hello from test'",
      });

      // 等待输出
      const outputMsg = await client.waitForMessage(
        (m) => m.type === "terminal_output" && m.sessionId === sessionId,
        10000
      );

      if (!outputMsg.data || !(outputMsg.data as string).includes("Hello from test")) {
        throw new Error(`意外的输出: ${outputMsg.data}`);
      }

      client.disconnect();
    });

    // 测试 4: 列出会话
    await reporter.runTest("列出会话", async () => {
      const client = new TestWebSocketClient(TEST_CONFIG.resultsDir);
      await client.connect(`ws://127.0.0.1:${TEST_CONFIG.port}/ws/terminal`);
      await client.waitForMessage((m) => m.type === "terminal_connected");

      client.send("terminal_list");

      const listMsg = await client.waitForMessage((m) => m.type === "terminal_list");

      if (!Array.isArray(listMsg.sessions)) {
        throw new Error("sessions 不是数组");
      }

      client.disconnect();
    });

    // 测试 5: 多会话管理
    await reporter.runTest("多会话管理", async () => {
      const client = new TestWebSocketClient(TEST_CONFIG.resultsDir);
      await client.connect(`ws://127.0.0.1:${TEST_CONFIG.port}/ws/terminal`);
      await client.waitForMessage((m) => m.type === "terminal_connected");

      client.clearMessages();

      // 创建第一个会话
      client.send("terminal_create", { name: "Session 1" });
      await delay(200);
      const s1 = await client.waitForMessage((m) => m.type === "terminal_created");
      logger.debug("Session 1 创建", { id: s1.sessionId });

      client.clearMessages();

      // 创建第二个会话
      client.send("terminal_create", { name: "Session 2" });
      await delay(200);
      const s2 = await client.waitForMessage((m) => m.type === "terminal_created");
      logger.debug("Session 2 创建", { id: s2.sessionId });

      if (!s1.sessionId || !s2.sessionId) {
        throw new Error("无法获取会话 ID");
      }

      if (s1.sessionId === s2.sessionId) {
        throw new Error("会话 ID 应该是唯一的");
      }

      client.disconnect();
    });

    // 测试 6: 命令多行输出
    await reporter.runTest("命令多行输出", async () => {
      const client = new TestWebSocketClient(TEST_CONFIG.resultsDir);
      await client.connect(`ws://127.0.0.1:${TEST_CONFIG.port}/ws/terminal`);
      await client.waitForMessage((m) => m.type === "terminal_connected");

      client.send("terminal_create", { name: "Output Test" });
      const created = await client.waitForMessage((m) => m.type === "terminal_created");
      const sessionId = created.sessionId as string;

      client.send("terminal_execute", {
        sessionId,
        command: "pwd",
      });

      const output = await client.waitForMessage(
        (m) => m.type === "terminal_output" && m.sessionId === sessionId,
        10000
      );

      logger.info("收到 pwd 输出", output);

      client.disconnect();
    });

    // 测试 7: 调整终端大小
    await reporter.runTest("调整终端大小", async () => {
      const client = new TestWebSocketClient(TEST_CONFIG.resultsDir);
      await client.connect(`ws://127.0.0.1:${TEST_CONFIG.port}/ws/terminal`);
      await client.waitForMessage((m) => m.type === "terminal_connected");

      client.send("terminal_create", { name: "Resize Test" });
      const created = await client.waitForMessage((m) => m.type === "terminal_created");
      const sessionId = created.sessionId as string;

      client.send("terminal_resize", {
        sessionId,
        cols: 120,
        rows: 40,
      });

      await delay(500);

      client.disconnect();
    });

    // 测试 8: 关闭会话
    await reporter.runTest("关闭会话", async () => {
      const client = new TestWebSocketClient(TEST_CONFIG.resultsDir);
      await client.connect(`ws://127.0.0.1:${TEST_CONFIG.port}/ws/terminal`);
      await client.waitForMessage((m) => m.type === "terminal_connected");

      client.send("terminal_create", { name: "Close Test" });
      const created = await client.waitForMessage((m) => m.type === "terminal_created");
      const sessionId = created.sessionId as string;

      client.send("terminal_execute", { sessionId, command: "exit" });
      await delay(500);
      client.send("terminal_close", { sessionId, force: true });

      const ended = await client.waitForMessage(
        (m) => m.type === "terminal_ended" && m.sessionId === sessionId,
        10000
      );

      logger.info("会话已关闭", ended);

      client.disconnect();
    });
  } finally {
    await server.stop();
  }
}

// ========== 主入口 ==========
logger.info("=== 终端服务端测试开始 ===");
runTests()
  .then(() => {
    reporter.generateReport();
    const failedCount = reporter.getResults().filter((r) => !r.passed).length;
    process.exit(failedCount > 0 ? 1 : 0);
  })
  .catch((error) => {
    logger.error("测试运行器失败", error);
    process.exit(1);
  });
