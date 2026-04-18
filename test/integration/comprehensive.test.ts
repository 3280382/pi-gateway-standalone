/**
 * Comprehensive Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  TestLogger,
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
} from "../lib/test-utils.js";
import { setTimeout as delay } from "node:timers/promises";

const logger = new TestLogger("comprehensive");
const reporter = new TestReporter("comprehensive");

describe("Comprehensive Integration Tests", () => {
  const server = new TestServerManager();
  let wsUrl: string;
  let httpUrl: string;

  beforeAll(async () => {
    logger.info("初始化综合集成测试");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
    httpUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("health check returns ok", async () => {
    await reporter.runTest("健康检查", async () => {
      const response = await fetch(`${httpUrl}/api/health`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe("ok");
      logger.info("健康检查通过", data);
    });
  });

  it("WebSocket full flow", async () => {
    await reporter.runTest("WebSocket 完整流程", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      // 1. 等待连接
      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );
      logger.info("1. 已连接");

      // 2. 初始化
      client.send("init", { workingDir: "/root" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );
      logger.info("2. 已初始化");

      // 3. 发送消息
      client.send("prompt", { text: "Hello" });
      const response = await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk",
        10000
      );
      logger.info("3. 收到响应", response);

      client.disconnect();
      logger.info("4. 已断开连接");
    });
  });

  it("multiple concurrent connections", async () => {
    await reporter.runTest("多并发连接", async () => {
      const clients: TestWebSocketClient[] = [];

      // 创建 3 个连接
      for (let i = 0; i < 3; i++) {
        const client = new TestWebSocketClient(wsUrl);
        await client.connect(wsUrl);
        await client.waitForMessage(
          (m) => m.type === "welcome" || m.type === "connected",
          5000
        );
        clients.push(client);
        logger.info(`客户端 ${i + 1} 已连接`);
      }

      // 断开所有连接
      for (const client of clients) {
        client.disconnect();
      }

      logger.info("所有客户端已断开");
    });
  });
});
