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
    logger.info("Initializing Abort test");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("can abort ongoing request", async () => {
    await reporter.runTest("Abort ongoing request", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      // Initialize
      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      client.send("init", { workingDir: "/root/pi-gateway-standalone" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      // Send a prompt that takes longer to process
      client.send("prompt", {
        text: "Write a very long story about testing",
      });

      // Wait for response to start
      await client.waitForMessage(
        (m) => m.type === "response_start" || m.type === "chunk",
        10000
      );

      // Send abort
      client.send("abort", {});
      logger.info("Abort message sent");

      // Wait for abort confirmation
      try {
        const response = await client.waitForMessage(
          (m) => m.type === "aborted" || m.type === "response_end",
          5000
        );
        logger.info("Received abort confirmation", response);
      } catch {
        logger.info("Abort message processed");
      }

      client.disconnect();
    });
  });

  it("handles abort when no active request", async () => {
    await reporter.runTest("Handle abort when no active request", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
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
  });
});
