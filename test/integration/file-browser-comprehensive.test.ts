/**
 * Comprehensive File Browser Integration Test
 * Tests all file browser features: sidebar, file selection, viewing, editing, execution
 */

import { spawn } from "node:child_process";
import { join } from "node:path";
import fetch from "node-fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SERVER_PORT = 3466;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

describe("Comprehensive File Browser Integration Test", () => {
  let serverProcess: ReturnType<typeof spawn>;

  beforeAll(async () => {
    // Start server
    const serverPath = join(__dirname, "..", "..", "dist", "server.js");
    serverProcess = spawn("node", [serverPath], {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: "pipe",
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server startup timeout")), 15000);
      serverProcess.stdout?.on("data", (data) => {
        if (data.toString().includes("Pi Gateway Server")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    // Wait a bit more for server to be fully ready
    await new Promise((r) => setTimeout(r, 1000));
  }, 30000);

  afterAll(async () => {
    serverProcess?.kill();
    await new Promise((r) => setTimeout(r, 500));
  });

  describe("File Browser API Endpoints", () => {
    it("should browse root directory", async () => {
      const response = await fetch(`${SERVER_URL}/api/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("currentPath");
      expect(data).toHaveProperty("items");
      expect(data).toHaveProperty("metadata");
      expect(data.metadata).toHaveProperty("count");
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should browse subdirectory", async () => {
      const response = await fetch(`${SERVER_URL}/api/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root/pi-gateway-standalone" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.currentPath).toBe("/root/pi-gateway-standalone");
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("should handle non-existent directory", async () => {
      const response = await fetch(`${SERVER_URL}/api/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/non/existent/path" }),
      });

      // Should return 200 with empty items or error in response
      expect(response.status).toBe(200);
      const data = await response.json();

      // Either empty items or error property
      expect(data.items.length === 0 || data.error).toBeTruthy();
    });

    it("should read file content", async () => {
      // First check if package.json exists
      const browseResponse = await fetch(`${SERVER_URL}/api/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root/pi-gateway-standalone" }),
      });

      const browseData = await browseResponse.json();
      const packageJson = browseData.items.find((item: any) => item.name === "package.json");

      if (packageJson) {
        const response = await fetch(`${SERVER_URL}/api/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: packageJson.path }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data).toHaveProperty("content");
        expect(typeof data.content).toBe("string");
        expect(data.content).toContain("pi-gateway-standalone");
      }
    });

    it("should execute shell command", async () => {
      const response = await fetch(`${SERVER_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: 'echo "test execution"' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("output");
      expect(data.output).toContain("test execution");
      expect(data.exitCode).toBe(0);
      expect(data.isError).toBe(false);
    });

    it("should handle command execution error", async () => {
      const response = await fetch(`${SERVER_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "nonexistentcommand" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should either have error or isError true
      expect(data.error || data.isError).toBeTruthy();
    });

    it("should get file info", async () => {
      const response = await fetch(`${SERVER_URL}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("exists");
      expect(data).toHaveProperty("isDirectory");
      expect(data.exists).toBe(true);
      expect(data.isDirectory).toBe(true);
    });

    it("should search files", async () => {
      const response = await fetch(`${SERVER_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/root/pi-gateway-standalone",
          query: "package.json",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("results");
      expect(Array.isArray(data.results)).toBe(true);
    });
  });

  describe("File Operations", () => {
    it("should create and delete temporary file", async () => {
      const tempPath = "/root/test_temp_file.txt";
      const content = "Test content for temporary file";

      // Create file
      const createResponse = await fetch(`${SERVER_URL}/api/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: tempPath,
          content: content,
        }),
      });

      expect(createResponse.status).toBe(200);
      const createData = await createResponse.json();
      expect(createData.success).toBe(true);

      // Read file to verify
      const readResponse = await fetch(`${SERVER_URL}/api/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: tempPath }),
      });

      expect(readResponse.status).toBe(200);
      const readData = await readResponse.json();
      expect(readData.content).toBe(content);

      // Delete file
      const deleteResponse = await fetch(`${SERVER_URL}/api/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: tempPath }),
      });

      expect(deleteResponse.status).toBe(200);
      const deleteData = await deleteResponse.json();
      expect(deleteData.success).toBe(true);
    });

    it("should copy and move files", async () => {
      const sourcePath = "/root/test_source.txt";
      const copyPath = "/root/test_copy.txt";
      const movePath = "/root/test_moved.txt";
      const content = "Test content for copy/move operations";

      // Create source file
      await fetch(`${SERVER_URL}/api/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: sourcePath,
          content: content,
        }),
      });

      // Copy file
      const copyResponse = await fetch(`${SERVER_URL}/api/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: sourcePath,
          destination: copyPath,
        }),
      });

      expect(copyResponse.status).toBe(200);
      const copyData = await copyResponse.json();
      expect(copyData.success).toBe(true);

      // Move file
      const moveResponse = await fetch(`${SERVER_URL}/api/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: copyPath,
          destination: movePath,
        }),
      });

      expect(moveResponse.status).toBe(200);
      const moveData = await moveResponse.json();
      expect(moveData.success).toBe(true);

      // Cleanup
      await fetch(`${SERVER_URL}/api/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: sourcePath }),
      });

      await fetch(`${SERVER_URL}/api/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: movePath }),
      });
    });
  });

  describe("File Format Support", () => {
    it("should handle different file formats", async () => {
      const testFiles = [
        { name: "test.js", content: 'console.log("JavaScript");' },
        { name: "test.py", content: 'print("Python")' },
        { name: "test.json", content: '{"key": "value"}' },
        { name: "test.md", content: "# Markdown Test" },
        { name: "test.html", content: "<html><body>Test</body></html>" },
        { name: "test.css", content: "body { color: red; }" },
      ];

      for (const file of testFiles) {
        const path = `/root/${file.name}`;

        // Create file
        await fetch(`${SERVER_URL}/api/write`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: path,
            content: file.content,
          }),
        });

        // Read file
        const readResponse = await fetch(`${SERVER_URL}/api/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: path }),
        });

        expect(readResponse.status).toBe(200);
        const readData = await readResponse.json();
        expect(readData.content).toBe(file.content);

        // Delete file
        await fetch(`${SERVER_URL}/api/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: path }),
        });
      }
    });
  });
});
