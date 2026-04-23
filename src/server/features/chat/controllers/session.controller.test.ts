/**
 * Session Controller Tests
 * Uses global server from vitest globalSetup
 * Note: Session listing/loading is now WebSocket-only.
 *       Only HTTP endpoints without WS equivalents are tested here.
 */

import { TestLogger, TestReporter } from "@test/lib/test-utils";
import { beforeAll, describe, expect, it } from "vitest";

const logger = new TestLogger("session-controller");
const reporter = new TestReporter("session-controller");

// Use port from global setup
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 3456;
const baseUrl = `http://127.0.0.1:${PORT}`;

describe("Session Controller", () => {
  beforeAll(() => {
    logger.info("Session Controller test starting", { baseUrl });
  });

  it("returns system prompt info", async () => {
    await reporter.runTest("Get system prompt", async () => {
      const response = await fetch(`${baseUrl}/api/system-prompt?cwd=/root/pi-gateway-standalone`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.cwd).toBeDefined();
      expect(data.systemPrompt).toBeDefined();
      expect(Array.isArray(data.agentsFiles)).toBe(true);
      expect(Array.isArray(data.skills)).toBe(true);
      logger.info("System prompt passed", {
        cwd: data.cwd,
        agentsFilesCount: data.agentsFiles?.length,
        skillsCount: data.skills?.length,
      });
    });
  }, 15000);
});
