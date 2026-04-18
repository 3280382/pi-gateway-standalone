/**
 * WebSocket Init Handler Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { 
  TestLogger, 
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
} from "../../../../test/lib/test-utils.js";

const logger = new TestLogger("ws-init");
const reporter = new TestReporter("ws-init");

describe("WebSocket Init Handler", () => {
  const server = new TestServerManager();
  let wsUrl: string;

  beforeAll(async () => {
    logger.info("初始化 WebSocket 测试");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("receives welcome message on connect", async () => {
    await reporter.runTest("连接后收到欢迎消息", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);
      
      const welcomeMsg = await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );
      
      expect(welcomeMsg).toBeDefined();
      logger.info("收到欢迎消息", welcomeMsg);
      
      client.disconnect();
    });
  });

  it("can send init message", async () => {
    await reporter.runTest("发送初始化消息", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);
      
      // 等待连接确认
      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );
      
      // 发送 init 消息
      client.send("init", {
        workingDir: "/root/pi-gateway-standalone",
      });
      
      // 等待确认
      const response = await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );
      
      expect(response).toBeDefined();
      logger.info("初始化确认收到", response);
      
      client.disconnect();
    });
  });
});
