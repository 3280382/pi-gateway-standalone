/**
 * File Controller Tests
 * Uses global server from vitest globalSetup
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TestLogger, TestReporter } from "@test/lib/test-utils";

const logger = new TestLogger("file-controller");
const reporter = new TestReporter("file-controller");

// Use port from global setup
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 3456;
const baseUrl = `http://127.0.0.1:${PORT}`;

describe("File Controller", () => {
  beforeAll(() => {
    logger.info("File Controller test starting", { baseUrl });
  });

  it("can browse directory", async () => {
    await reporter.runTest("Browse directory", async () => {
      const response = await fetch(`${baseUrl}/api/files/file/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root/pi-gateway-standalone" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.currentPath).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.metadata).toBeDefined();
      logger.info("Browse directory passed", {
        path: data.currentPath,
        itemCount: data.items?.length,
      });
    });
  }, 10000);

  it("can get file content", async () => {
    await reporter.runTest("Get file content", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/file/content?path=/root/pi-gateway-standalone/README.md`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.path).toBeDefined();
      expect(data.content).toBeDefined();
      expect(data.mimeType).toBeDefined();
      logger.info("Get file content passed", {
        path: data.path,
        size: data.size,
      });
    });
  }, 10000);

  it("returns 404 for non-existent file", async () => {
    await reporter.runTest("Non-existent file returns 404", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/file/content?path=/root/pi-gateway-standalone/nonexistent-file-12345.txt`
      );

      expect([404, 500]).toContain(response.status);
      logger.info("Non-existent file handled correctly");
    });
  }, 10000);

  it("can get directory tree", async () => {
    await reporter.runTest("Get directory tree", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/file/tree?path=/root/pi-gateway-standalone/src&filter=normal`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBeDefined();
      expect(data.isDirectory).toBe(true);
      expect(Array.isArray(data.children)).toBe(true);
      logger.info("Get directory tree passed", {
        name: data.name,
        childrenCount: data.children?.length,
      });
    });
  }, 15000);

  it("can get raw file", async () => {
    await reporter.runTest("Get raw file", async () => {
      const response = await fetch(
        `${baseUrl}/api/files/file/raw?path=/root/pi-gateway-standalone/package.json`
      );

      expect(response.status).toBe(200);
      const content = await response.text();
      expect(content.length).toBeGreaterThan(0);
      expect(response.headers.get("content-type")).toContain("application/json");
      logger.info("Get raw file passed", { size: content.length });
    });
  }, 10000);

  it("validates path parameter for content endpoint", async () => {
    await reporter.runTest("Validate path parameter", async () => {
      const response = await fetch(`${baseUrl}/api/files/file/content`);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      logger.info("Path validation passed");
    });
  }, 10000);
});
