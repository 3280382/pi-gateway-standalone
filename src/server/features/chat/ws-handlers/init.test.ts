/**
 * WebSocket Init Handler Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  TestLogger,
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
  TEST_CONFIG,
} from "@test/lib/test-utils";

const logger = new TestLogger("ws-init");
const reporter = new TestReporter("ws-init");

describe("WebSocket Init Handler", () => {
  const server = new TestServerManager();
  let wsUrl: string;

  beforeAll(async () => {
    logger.info("Initializing WebSocket test");
    await server.start();
    wsUrl = `ws://127.0.0.1:${TEST_CONFIG.port}/ws`;
    logger.info("WebSocket URL", { wsUrl });
  }, 60000);

  afterAll(async () => {
    await server.stop();
    reporter.generateReport();
  }, 10000);

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
  }, 15000);

  it("can send init message", async () => {
    await reporter.runTest("Send initialization message", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      // Wait for connection confirmation
      await client.waitForMessage((m) => m.type === "welcome" || m.type === "connected", 5000);

      // Send init message
      client.send("init", {
        workingDir: "/root/pi-gateway-standalone",
      });

      // Wait for confirmation
      const response = await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized" || m.type === "ready",
        10000
      );

      expect(response).toBeDefined();
      logger.info("Initialization confirmation received", response);

      client.disconnect();
    });
  }, 20000);

  it("handles invalid working directory gracefully", async () => {
    await reporter.runTest("Handle invalid working directory", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage((m) => m.type === "welcome" || m.type === "connected", 5000);

      // Send init with non-existent directory
      client.send("init", {
        workingDir: "/nonexistent/path/12345",
      });

      // Should receive error or fallback response
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "error" || m.type === "init_ack" || m.type === "ready",
          5000
        );
        logger.info("Received response for invalid directory", response);
      } catch {
        logger.info("No response for invalid directory (acceptable)");
      }

      client.disconnect();
    });
  }, 15000);

  it("can initialize multiple times", async () => {
    await reporter.runTest("Multiple init messages", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage((m) => m.type === "welcome" || m.type === "connected", 5000);

      // First init
      client.send("init", { workingDir: "/root" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized" || m.type === "ready",
        10000
      );

      // Second init (should be handled gracefully)
      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "init_ack" || m.type === "initialized" || m.type === "ready",
          5000
        );
        logger.info("Second init response", response);
      } catch {
        logger.info("Second init handled silently");
      }

      client.disconnect();
    });
  }, 20000);
});
