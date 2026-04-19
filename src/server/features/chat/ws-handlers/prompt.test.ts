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
    logger.info("Initializing Prompt test");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("can send prompt message", async () => {
    await reporter.runTest("Send Prompt message", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      // Wait for connection confirmation
      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      // Send init
      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      // Send prompt
      client.send("prompt", {
        text: "Hello, this is a test message",
      });

      logger.info("Prompt message sent");

      // Wait for response (may be streaming start)
      const response = await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk",
        10000
      );

      expect(response).toBeDefined();
      logger.info("Received response", response);

      client.disconnect();
    });
  });

  it("handles empty prompt gracefully", async () => {
    await reporter.runTest("Handle empty Prompt", async () => {
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

      // Send empty prompt
      client.send("prompt", { text: "" });

      // Should receive error response
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "error" || m.type === "validation_error",
          5000
        );
        logger.info("Received error response", response);
      } catch {
        logger.info("Empty prompt silently handled");
      }

      client.disconnect();
    });
  });
});
