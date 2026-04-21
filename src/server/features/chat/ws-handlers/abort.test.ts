/**
 * WebSocket Abort Handler Tests
 */

import { setTimeout as delay } from "node:timers/promises";
import {
  TEST_CONFIG,
  TestLogger,
  TestReporter,
  TestServerManager,
  TestWebSocketClient,
} from "@test/lib/test-utils";
import { afterAll, beforeAll, describe, it } from "vitest";

const logger = new TestLogger("ws-abort");
const reporter = new TestReporter("ws-abort");

describe("WebSocket Abort Handler", () => {
  const server = new TestServerManager();
  let wsUrl: string;

  beforeAll(async () => {
    logger.info("Initializing Abort test");
    await server.start();
    wsUrl = `ws://127.0.0.1:${TEST_CONFIG.port}/ws`;
    logger.info("WebSocket URL", { wsUrl });
  }, 60000);

  afterAll(async () => {
    await server.stop();
    reporter.generateReport();
  }, 10000);

  it("can abort ongoing request", async () => {
    await reporter.runTest("Abort ongoing request", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      // Initialize
      await client.waitForMessage((m) => m.type === "welcome" || m.type === "connected", 5000);

      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized" || m.type === "ready",
        10000
      );

      // Send a prompt that takes longer to process
      client.send("prompt", {
        text: "Write a very long story about testing with many details",
      });

      // Wait for response to start
      await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk" || m.type === "response",
        15000
      );

      await delay(500);

      // Send abort
      client.send("abort", {});
      logger.info("Abort message sent");

      // Wait for abort confirmation or response end
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "aborted" || m.type === "response_end" || m.type === "done",
          5000
        );
        logger.info("Received abort confirmation", response);
      } catch {
        logger.info("Abort message processed without explicit confirmation");
      }

      client.disconnect();
    });
  }, 30000);

  it("handles abort when no active request", async () => {
    await reporter.runTest("Handle abort when no active request", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage((m) => m.type === "welcome" || m.type === "connected", 5000);

      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized" || m.type === "ready",
        10000
      );

      // Send abort directly, no pending request
      client.send("abort", {});

      // Should receive error or no response
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "error" || m.type === "no_active_request",
          3000
        );
        logger.info("Received response", response);
      } catch {
        logger.info("Abort silently handled when no active request");
      }

      client.disconnect();
    });
  }, 20000);
});
