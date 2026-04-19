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
    logger.info("Initializing WebSocket test");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("receives welcome message on connect", async () => {
    await reporter.runTest("Receive welcome message after connection", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);
    
      const welcomeMsg = await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );
    
      expect(welcomeMsg).toBeDefined();
      logger.info("Received welcome message", welcomeMsg);
    
      client.disconnect();
    });
  });

  it("can send init message", async () => {
    await reporter.runTest("Send initialization message", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);
    
      // Wait for connection confirmation
      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );
    
      // Send init message
      client.send("init", {
        workingDir: "/root/pi-gateway-standalone",
      });
    
      // Wait for confirmation
      const response = await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );
    
      expect(response).toBeDefined();
      logger.info("Initialization confirmation received", response);
    
      client.disconnect();
    });
  });
});
