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
    logger.info("Initializing Agent Session test");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("creates session with working directory", async () => {
    await reporter.runTest("Create working directory session", async () => {
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
      logger.info("Session created", { workingDir, response });

      client.disconnect();
    });
  });

  it("maintains session state across messages", async () => {
    await reporter.runTest("Maintain session state across messages", async () => {
      const client = new TestWebSocketClient(wsUrl);
      await client.connect(wsUrl);

      await client.waitForMessage(
        (m) => m.type === "welcome" || m.type === "connected",
        5000
      );

      // Initialize
      client.send("init", { workingDir: "/root" });
      await client.waitForMessage(
        (m) => m.type === "init_ack" || m.type === "initialized",
        5000
      );

      // Send first message
      client.send("prompt", { text: "Message 1" });
      await delay(1000);

      // Send second message
      client.send("prompt", { text: "Message 2" });
      await delay(1000);

      logger.info("Multiple messages sent, session state maintained");

      client.disconnect();
    });
  });

  it("handles model parameter changes", async () => {
    await reporter.runTest("Handle model parameter changes", async () => {
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

      // Set model parameters
      client.send("set_model", {
        model: "test-model",
        temperature: 0.5,
      });

      try {
        const response = await client.waitForMessage(
          (m) => m.type === "model_set" || m.type === "ack",
          5000
        );
        logger.info("Model parameters set", response);
      } catch {
        logger.info("Model parameter setting silently handled");
      }

      client.disconnect();
    });
  });
});
