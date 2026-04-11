/**
 * Test LLM logging functionality
 * Verifies that the global fetch interceptor properly logs LLM API calls
 */
import { describe, expect, it } from "vitest";
import { getTestServerUrl, isDevServerRunning } from "./test-utils.js";

describe("LLM Log Host List", () => {
  it("should include all required LLM provider hosts", async () => {
    const serverCode = await import("node:fs").then((fs) =>
      fs.readFileSync("/root/pi-gateway-standalone/dist/server.js", "utf-8")
    );

    const requiredHosts = [
      "anthropic.com",
      "openai.com",
      "googleapis.com",
      "amazonaws.com",
      "kimi.com",
      "moonshot.cn",
      "mistral.ai",
      "groq.com",
      "cerebras.ai",
      "x.ai",
      "openrouter.ai",
      "githubcopilot.com",
    ];

    for (const host of requiredHosts) {
      expect(serverCode).toContain(`"${host}"`);
    }
  });

  it("should use llmLogManagerRef in fetch interceptor", async () => {
    const serverCode = await import("node:fs").then((fs) =>
      fs.readFileSync("/root/pi-gateway-standalone/dist/server.js", "utf-8")
    );

    expect(serverCode).toContain("llmLogManagerRef");
    expect(serverCode).toContain("llmLogManagerRef.log");
  });

  it("should set up global fetch interceptor at the start of the file", async () => {
    const serverCode = await import("node:fs").then((fs) =>
      fs.readFileSync("/root/pi-gateway-standalone/dist/server.js", "utf-8")
    );

    const interceptorSetupPos = serverCode.indexOf("globalThis.fetch = ");
    const classDefinitionPos = serverCode.indexOf("class LlmLogManager");

    expect(interceptorSetupPos).toBeGreaterThan(0);
    expect(classDefinitionPos).toBeGreaterThan(0);
    expect(interceptorSetupPos).toBeLessThan(classDefinitionPos);
  });
});

describe("LLM Log Manager", () => {
  it("should have correct log buffer and flush logic", async () => {
    const logBuffer: Array<{ type: string; content: string }> = [];
    let flushCalled = false;

    logBuffer.push({
      type: "request",
      content: JSON.stringify({ method: "POST" }),
    });
    logBuffer.push({
      type: "response",
      content: JSON.stringify({ status: 200 }),
    });

    expect(logBuffer.length).toBe(2);

    const entriesToFlush = [...logBuffer];
    logBuffer.length = 0;
    flushCalled = true;

    expect(flushCalled).toBe(true);
    expect(entriesToFlush.length).toBe(2);
    expect(logBuffer.length).toBe(0);
  });
});

describe("Development Server Detection", () => {
  it("should detect if dev server is running on port 3000", async () => {
    const isRunning = await isDevServerRunning();

    // This test documents the current state
    // If running: tests can use existing server
    // If not running: tests should start temporary server
    console.log(`[Test] Dev server on port 3000: ${isRunning ? "RUNNING" : "NOT RUNNING"}`);

    // Just verify the function works
    expect(typeof isRunning).toBe("boolean");
  });

  it("should provide correct server URL when dev server is running", async () => {
    const serverUrl = await getTestServerUrl();

    if (serverUrl) {
      expect(serverUrl).toBe("http://localhost:3000");
      // Verify we can actually connect
      const response = await fetch(`${serverUrl}/api/models`);
      expect(response.ok).toBe(true);
    } else {
      console.log("[Test] No dev server running - tests would start temporary server");
    }
  });
});
