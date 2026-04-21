/**
 * Server Routes Tests
 * Uses global server from vitest globalSetup
 */

import { TestLogger, TestReporter } from "@test/lib/test-utils";
import { beforeAll, describe, expect, it } from "vitest";

const logger = new TestLogger("routes");
const reporter = new TestReporter("routes");

// Use port from global setup
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 3456;
const baseUrl = `http://127.0.0.1:${PORT}`;

describe("Server Routes", () => {
  beforeAll(() => {
    logger.info("Server Routes test starting", { baseUrl });
  });

  it("health endpoint returns 200", async () => {
    await reporter.runTest("Health check endpoint", async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("healthy");
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
      logger.info("Health check passed", data);
    });
  }, 10000);

  it("404 for unknown routes", async () => {
    await reporter.runTest("Unknown route returns 404", async () => {
      const response = await fetch(`${baseUrl}/api/unknown-route`);
      expect(response.status).toBe(404);
      logger.info("404 response correct");
    });
  }, 10000);

  it("CORS headers are present", async () => {
    await reporter.runTest("CORS response headers", async () => {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
        },
      });

      expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
      logger.info("CORS response headers correct");
    });
  }, 10000);

  it("API version endpoint returns version info", async () => {
    await reporter.runTest("API version endpoint", async () => {
      const response = await fetch(`${baseUrl}/api/version`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.pid).toBeDefined();
      expect(data.startTime).toBeDefined();
      expect(data.uptime).toBeDefined();
      expect(data.nodeVersion).toBeDefined();
      logger.info("Version endpoint passed", data);
    });
  }, 10000);

  it("models endpoint returns model list", async () => {
    await reporter.runTest("Models endpoint", async () => {
      const response = await fetch(`${baseUrl}/api/models`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.models)).toBe(true);
      logger.info("Models endpoint passed", { count: data.models?.length });
    });
  }, 10000);

  it("workspace current endpoint returns workspace info", async () => {
    await reporter.runTest("Workspace current endpoint", async () => {
      const response = await fetch(`${baseUrl}/api/workspace/current`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.path).toBeDefined();
      expect(data.name).toBeDefined();
      logger.info("Workspace endpoint passed", data);
    });
  }, 10000);

  it("sessions endpoint returns session list", async () => {
    await reporter.runTest("Sessions endpoint", async () => {
      const response = await fetch(`${baseUrl}/api/sessions?cwd=/root/pi-gateway-standalone`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.sessions)).toBe(true);
      logger.info("Sessions endpoint passed", { count: data.sessions?.length });
    });
  }, 15000);
});
