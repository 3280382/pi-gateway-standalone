/**
 * WebSocket Prompt Handler Tests
 */

import { setTimeout as delay } from "node:timers/promises";
import {
  TEST_CONFIG,
  TestLogger,
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
} from "@test/lib/test-utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const logger = new TestLogger("ws-prompt");
const reporter = new TestReporter("ws-prompt");

describe("WebSocket Prompt Handler", () => {
  const server = new TestServerManager();
  let wsUrl: string;

  beforeAll(async () => {
    logger.info("Initializing Prompt test");
    await server.start();
    wsUrl = `ws://127.0.0.1:${TEST_CONFIG.port}/ws`;
    logger.info("WebSocket URL", { wsUrl });
  }, 60000);

  afterAll(async () => {
    await server.stop();
    reporter.generateReport();
  }, 10000);

  it("can send prompt message", async () => {
    await reporter.runTest("Send Prompt message", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      // Wait for connection confirmation
      await client.waitForMessage((m) => m.type === "welcome" || m.type === "connected", 5000);

      // Send init
      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized" || m.type === "ready",
        10000
      );

      // Send prompt
      client.send("prompt", {
        text: "Hello, this is a test message",
      });

      logger.info("Prompt message sent");

      // Wait for response (may be streaming start)
      const response = await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk" || m.type === "response",
        15000
      );

      expect(response).toBeDefined();
      logger.info("Received response", response);

      client.disconnect();
    });
  }, 30000);

  it("handles empty prompt gracefully", async () => {
    await reporter.runTest("Handle empty Prompt", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage((m) => m.type === "welcome" || m.type === "connected", 5000);

      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized" || m.type === "ready",
        10000
      );

      // Send empty prompt
      client.send("prompt", { text: "" });

      // Should receive error response or be handled gracefully
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
  }, 20000);

  it("can send multiple prompts in sequence", async () => {
    await reporter.runTest("Multiple sequential prompts", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage((m) => m.type === "welcome" || m.type === "connected", 5000);

      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized" || m.type === "ready",
        10000
      );

      // Send first prompt
      client.send("prompt", { text: "First test message" });
      await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk" || m.type === "response",
        15000
      );

      await delay(1000);

      // Send second prompt
      client.send("prompt", { text: "Second test message" });
      const response2 = await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk" || m.type === "response",
        15000
      );

      expect(response2).toBeDefined();
      logger.info("Second prompt response received");

      client.disconnect();
    });
  }, 40000);
});
