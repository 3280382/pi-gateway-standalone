import { spawn } from "node:child_process";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SERVER_PORT = 3475;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

describe("Gateway API", () => {
  let serverProcess: ReturnType<typeof spawn>;

  beforeAll(async () => {
    console.log(`🚀 Starting test server on port ${SERVER_PORT}...`);
    const serverPath = join(__dirname, "..", "..", "..", "src", "server", "server.ts");
    serverProcess = spawn("npx", ["tsx", serverPath], {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: "pipe",
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Server startup timeout after 30000ms`)),
        30000
      );
      let _output = "";
      const handleData = (data: Buffer) => {
        const text = data.toString();
        _output += text;
        console.log(`[Server Output] ${text.trim()}`);
        if (text.includes("Server started on") || text.includes("Pi Gateway Server")) {
          console.log(`✅ Server started successfully`);
          clearTimeout(timeout);
          serverProcess.stdout?.off("data", handleData);
          serverProcess.stderr?.off("data", handleData);
          resolve();
        }
      };
      serverProcess.stdout?.on("data", handleData);
      serverProcess.stderr?.on("data", handleData);

      serverProcess.on("error", (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });

      serverProcess.on("exit", (code, signal) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Server process exited, code: ${code}, signal: ${signal}`));
        }
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`✅ Server startup complete, ready for testing`);
  }, 45000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill("SIGKILL");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!serverProcess.killed) {
        serverProcess.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  });

  describe("GET /api/models", () => {
    it("should return list of available models", async () => {
      const response = await fetch(`${SERVER_URL}/api/models`);
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.models).toBeDefined();
      expect(Array.isArray(data.models)).toBe(true);
    });

    it("should return models with required fields", async () => {
      const response = await fetch(`${SERVER_URL}/api/models`);
      const data = await response.json();

      if (data.models.length > 0) {
        const model = data.models[0];
        expect(model.id).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(model.name).toBeDefined();
      }
    });
  });

  describe("GET /api/sessions", () => {
    it("should return sessions for given cwd", async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions?cwd=/root`);
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.sessions).toBeDefined();
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    it("should handle missing cwd parameter", async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions`);
      expect(response.ok).toBe(true);
    });

    it("should return session with required fields", async () => {
      const response = await fetch(`${SERVER_URL}/api/sessions?cwd=/root/.pi/agent`);
      const data = await response.json();

      if (data.sessions.length > 0) {
        const session = data.sessions[0];
        expect(session.id).toBeDefined();
        expect(session.path).toBeDefined();
        expect(session.modified).toBeDefined();
        expect(session.messageCount).toBeDefined();
      }
    });
  });

  describe("POST /api/files/file/browse", () => {
    it("should list directory contents", async () => {
      const response = await fetch(`${SERVER_URL}/api/files/file/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root" }),
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.currentPath).toBeDefined();
      expect(data.parentPath).toBeDefined();
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.metadata).toBeDefined();
    });

    it("should return file items with required fields", async () => {
      const response = await fetch(`${SERVER_URL}/api/files/file/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/root" }),
      });

      const data = await response.json();

      if (data.items.length > 0) {
        const item = data.items[0];
        expect(item.name).toBeDefined();
        expect(item.path).toBeDefined();
        expect(typeof item.isDirectory).toBe("boolean");
        expect(item.size).toBeDefined();
        expect(item.modified).toBeDefined();
      }
    });

    it("should handle non-existent directory", async () => {
      const response = await fetch(`${SERVER_URL}/api/files/file/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "/nonexistent/path/12345" }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it("should default to home directory when path not provided", async () => {
      const response = await fetch(`${SERVER_URL}/api/files/file/browse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.currentPath).toBeDefined();
    });
  });

  describe("POST /api/session/load", () => {
    it("should load session file content", async () => {
      const sessionsResponse = await fetch(`${SERVER_URL}/api/sessions?cwd=/root/.pi/agent`);
      const sessionsData = await sessionsResponse.json();

      if (!sessionsData.sessions || sessionsData.sessions.length === 0) {
        console.log("No sessions found, skipping load test");
        return;
      }

      const sessionPath = sessionsData.sessions[0].path;
      const response = await fetch(`${SERVER_URL}/api/session/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionPath }),
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.path).toBe(sessionPath);
      expect(data.entries).toBeDefined();
      expect(Array.isArray(data.entries)).toBe(true);
    });

    it("should return error for missing sessionPath", async () => {
      const response = await fetch(`${SERVER_URL}/api/session/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it("should return error for invalid session file", async () => {
      const response = await fetch(`${SERVER_URL}/api/session/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionPath: "/nonexistent/session.jsonl" }),
      });

      expect(response.ok).toBe(false);
      expect([404, 500]).toContain(response.status);
    });
  });

  describe("GET /api/files/file/content", () => {
    it("should get file content", async () => {
      const response = await fetch(
        `${SERVER_URL}/api/files/file/content?path=/root/pi-gateway-standalone/README.md`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.path).toBeDefined();
      expect(data.content).toBeDefined();
      expect(data.mimeType).toBeDefined();
    });

    it("should return 400 for missing path", async () => {
      const response = await fetch(`${SERVER_URL}/api/files/file/content`);
      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const response = await fetch(`${SERVER_URL}/api/health`);
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBeDefined();
    });
  });
});
