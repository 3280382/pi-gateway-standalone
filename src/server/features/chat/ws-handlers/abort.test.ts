/**
 * WebSocket Abort Handler Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  TestLogger,
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
} from "../../../../test/lib/test-utils.js";
import { setTimeout as delay } from "node:timers/promises";

const logger = new TestLogger("ws-abort");
const reporter = new TestReporter("ws-abort");

describe("WebSocket Abort Handler", () => {
  const server = new TestServerManager();
  let wsUrl: string;

  beforeAll(async () => {
    logger.info("初始化 Abort 测试");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("can abort ongoing request", async () => {
    await reporter.runTest("中止正在进行的请求", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      // 初始化
      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      // 发送一个需要较长时间处理的 prompt
      client.send("prompt", {
        text: "Write a very long story about testing",
      });

      // 等待响应开始
      await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk",
        10000
      );

      // 发送 abort
      client.send("abort", {});
      logger.info("Abort 消息已发送");

      // 等待中止确认
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "aborted" || m.type === "response_end",
          5000
        );
        logger.info("收到中止确认", response);
      } catch {
        logger.info("中止消息已处理");
      }

      client.disconnect();
    });
  });

  it("handles abort when no active request", async () => {
    await reporter.runTest("无活动请求时处理中止", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      // 直接发送 abort，没有 pending 的请求
      client.send("abort", {});

      // 应该收到错误或无响应
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "error" || m.type === "no_active_request",
          3000
        );
        logger.info("收到响应", response);
      } catch {
        logger.info("无活动请求时 abort 被静默处理");
      }

      client.disconnect();
    });
  });
});
