/**
 * Server Routes Tests
 * Standard: Use utility functions from test/lib/test-utils.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { 
  TestLogger, 
  TestReporter,
  TestServerManager,
} from "../../../test/lib/test-utils.js";

const logger = new TestLogger("routes");
const reporter = new TestReporter("routes");

// Note: These tests require server running
describe("Server Routes", () => {
  const server = new TestServerManager();
  let baseUrl: string;

  beforeAll(async () => {
    logger.info("Initializing route test");
    await server.start();
    const port = process.env.TEST_PORT || 3000;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    server.stop();
    reporter.generateReport();
  });

  it("health endpoint returns 200", async () => {
    await reporter.runTest("Health check endpoint", async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);
    
      const data = await response.json();
      expect(data.status).toBe("ok");
      logger.info("Health check passed", data);
    });
  });

  it("404 for unknown routes", async () => {
    await reporter.runTest("Unknown route returns 404", async () => {
      const response = await fetch(`${baseUrl}/api/unknown-route`);
      expect(response.status).toBe(404);
      logger.info("404 response correct");
    });
  });

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
  });
});
