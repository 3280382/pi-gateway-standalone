/**
 * Workspace Controller Tests
 * Uses global server from vitest globalSetup
 */

import { TestLogger, TestReporter } from "@test/lib/test-utils";
import { beforeAll, describe, expect, it } from "vitest";

const logger = new TestLogger("workspace-controller");
const reporter = new TestReporter("workspace-controller");

// Use port from global setup
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 3456;
const baseUrl = `http://127.0.0.1:${PORT}`;

describe("Workspace Controller", () => {
  beforeAll(() => {
    logger.info("Workspace Controller test starting", { baseUrl });
  });

  it("returns current workspace info", async () => {
    await reporter.runTest("Get current workspace", async () => {
      const response = await fetch(`${baseUrl}/api/workspace/current`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.path).toBeDefined();
      expect(data.name).toBeDefined();
      expect(data.isCurrent).toBe(true);
      logger.info("Current workspace passed", data);
    });
  }, 10000);

  it("returns working directory", async () => {
    await reporter.runTest("Get working directory", async () => {
      const response = await fetch(`${baseUrl}/api/workspace/working-dir`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.cwd).toBeDefined();
      logger.info("Working directory passed", data);
    });
  }, 10000);

  it("returns recent workspaces", async () => {
    await reporter.runTest("Get recent workspaces", async () => {
      const response = await fetch(`${baseUrl}/api/workspace/recent`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.workspaces)).toBe(true);
      logger.info("Recent workspaces passed", { count: data.workspaces?.length });
    });
  }, 10000);

  it("can add recent workspace", async () => {
    await reporter.runTest("Add recent workspace", async () => {
      const response = await fetch(`${baseUrl}/api/workspace/add-recent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root/pi-gateway-standalone" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      logger.info("Add recent workspace passed");
    });
  }, 10000);

  it("validates path when adding recent workspace", async () => {
    await reporter.runTest("Validate path for recent workspace", async () => {
      const response = await fetch(`${baseUrl}/api/workspace/add-recent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Missing path
      });

      expect(response.status).toBe(400);
      logger.info("Path validation passed");
    });
  }, 10000);

  it("can clear recent workspaces", async () => {
    await reporter.runTest("Clear recent workspaces", async () => {
      const response = await fetch(`${baseUrl}/api/workspace/clear-recent`, {
        method: "DELETE",
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      logger.info("Clear recent workspaces passed");
    });
  }, 10000);
});
