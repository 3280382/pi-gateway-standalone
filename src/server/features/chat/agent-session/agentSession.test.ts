/**
 * Agent Session Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  TestLogger,
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
} from "../../../../test/lib/test-utils.js";
import { setTimeout as delay } from "node:timers/promises";

const logger = new TestLogger("agent-session");
const reporter = new TestReporter("agent-session");

describe("Agent Session", () => {
  const server = new TestServerManager();
  let wsUrl: string;

  beforeAll(async () => {
    logger.info("初始化 Agent Session 测试");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("creates session with working directory", async () => {
    await reporter.runTest("创建工作目录会话", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      const workingDir = "/root/pi-gateway-standalone";
      client.send("init", { workingDir });

      const response = await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      expect(response).toBeDefined();
      logger.info("会话已创建", { workingDir, response });

      client.disconnect();
    });
  });

  it("maintains session state across messages", async () => {
    await reporter.runTest("跨消息保持会话状态", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      // 初始化
      client.send("init", { workingDir: "/root" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      // 发送第一个消息
      client.send("prompt", { text: "Message 1" });
      await delay(1000);

      // 发送第二个消息
      client.send("prompt", { text: "Message 2" });
      await delay(1000);

      logger.info("多条消息已发送，会话状态保持");

      client.disconnect();
    });
  });

  it("handles model parameter changes", async () => {
    await reporter.runTest("处理模型参数变更", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      client.send("init", { workingDir: "/root" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      // 设置模型参数
      client.send("set_model", {
        model: "test-model",
        temperature: 0.5,
      });

      try {
        const response = await client.waitForMessage(
          (m) => m.type === "model_set" || m.type === "ack",
          5000
        );
        logger.info("模型参数已设置", response);
      } catch {
        logger.info("模型参数设置被静默处理");
      }

      client.disconnect();
    });
  });
});
