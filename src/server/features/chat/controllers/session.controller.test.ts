/**
 * Session Controller Tests
 * Uses global server from vitest globalSetup
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

  it("returns session list for directory", async () => {
    await reporter.runTest("Get sessions list", async () => {
      const response = await fetch(`${baseUrl}/api/sessions?cwd=/root/pi-gateway-standalone`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.sessions)).toBe(true);
      logger.info("Sessions list passed", { count: data.sessions?.length });
    });
  }, 15000);

  it("validates cwd parameter for sessions", async () => {
    await reporter.runTest("Validate sessions cwd parameter", async () => {
      const response = await fetch(`${baseUrl}/api/sessions`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.sessions)).toBe(true);
      logger.info("Sessions without cwd handled");
    });
  }, 10000);

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

  it("returns active sessions", async () => {
    await reporter.runTest("Get active sessions", async () => {
      const response = await fetch(
        `${baseUrl}/api/sessions/active?workingDir=/root/pi-gateway-standalone`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workingDir).toBeDefined();
      expect(Array.isArray(data.activeSessions)).toBe(true);
      logger.info("Active sessions passed", {
        workingDir: data.workingDir,
        count: data.activeSessions?.length,
      });
    });
  }, 10000);

  it("validates workingDir for active sessions", async () => {
    await reporter.runTest("Validate active sessions workingDir", async () => {
      const response = await fetch(`${baseUrl}/api/sessions/active`);

      expect(response.status).toBe(400);
      logger.info("Active sessions parameter validation passed");
    });
  }, 10000);

  it("handles non-existent session load gracefully", async () => {
    await reporter.runTest("Handle non-existent session", async () => {
      const response = await fetch(`${baseUrl}/api/session/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionPath: "/nonexistent/path/session-12345.jsonl",
        }),
      });

      expect(response.status).toBe(404);
      logger.info("Non-existent session handled correctly");
    });
  }, 10000);
});
