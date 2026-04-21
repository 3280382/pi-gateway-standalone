/**
 * Git Controller Tests
 * Uses global server from vitest globalSetup
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TestLogger, TestReporter } from "@test/lib/test-utils";

const logger = new TestLogger("git-controller");
const reporter = new TestReporter("git-controller");

// Use port from global setup
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 3456;
const baseUrl = `http://127.0.0.1:${PORT}`;

describe("Git Controller", () => {
  beforeAll(() => {
    logger.info("Git Controller test starting", { baseUrl });
  });

  it("checks if directory is git repository", async () => {
    await reporter.runTest("Check if git repository", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/git/check?workingDir=/root/pi-gateway-standalone`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(typeof data.isGitRepo).toBe("boolean");
      logger.info("Git check passed", { isGitRepo: data.isGitRepo });
    });
  }, 10000);

  it("returns git status for directory", async () => {
    await reporter.runTest("Get git status", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/git/status?workingDir=/root/pi-gateway-standalone`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(typeof data.statuses).toBe("object");
      logger.info("Git status passed", { statusCount: Object.keys(data.statuses).length });
    });
  }, 10000);

  it("returns git history for a file", async () => {
    await reporter.runTest("Get git history for file", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/git/history?filePath=README.md&workingDir=/root/pi-gateway-standalone`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.history)).toBe(true);
      if (data.history.length > 0) {
        expect(data.history[0].hash).toBeDefined();
        expect(data.history[0].message).toBeDefined();
        expect(data.history[0].author).toBeDefined();
      }
      logger.info("Git history passed", { historyCount: data.history?.length });
    });
  }, 10000);

  it("validates required parameters for history", async () => {
    await reporter.runTest("Validate history parameters", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/git/history?workingDir=/root/pi-gateway-standalone`
      );

      expect(response.status).toBe(400);
      logger.info("History parameter validation passed");
    });
  }, 10000);

  it("handles non-git directory gracefully", async () => {
    await reporter.runTest("Handle non-git directory", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/git/history?filePath=test.txt&workingDir=/tmp`
      );

      expect([200, 400]).toContain(response.status);
      logger.info("Non-git directory handled", { status: response.status });
    });
  }, 10000);
});
