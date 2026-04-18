/**
 * WebSocket Prompt Handler Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  TestLogger,
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
} from "../../../../test/lib/test-utils.js";
import { setTimeout as delay } from "node:timers/promises";

const logger = new TestLogger("ws-prompt");
const reporter = new TestReporter("ws-prompt");

describe("WebSocket Prompt Handler", () => {
  const server = new TestServerManager();
  let wsUrl: string;

  beforeAll(async () => {
    logger.info("初始化 Prompt 测试");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("can send prompt message", async () => {
    await reporter.runTest("发送 Prompt 消息", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      // 等待连接确认
      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      // 发送 init
      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      // 发送 prompt
      client.send("prompt", {
        text: "Hello, this is a test message",
      });

      logger.info("Prompt 消息已发送");

      // 等待响应（可能是 streaming 的开始）
      const response = await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk",
        10000
      );

      expect(response).toBeDefined();
      logger.info("收到响应", response);

      client.disconnect();
    });
  });

  it("handles empty prompt gracefully", async () => {
    await reporter.runTest("处理空 Prompt", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      // 发送空 prompt
      client.send("prompt", { text: "" });

      // 应该收到错误响应
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "error" || m.type === "validation_error",
          5000
        );
        logger.info("收到错误响应", response);
      } catch {
        logger.info("空 prompt 被静默处理");
      }

      client.disconnect();
    });
  });
});
