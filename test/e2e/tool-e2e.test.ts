/**
 * End-to-end test for tool display with real WebSocket
 * Tests the complete flow including frontend message handling
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const SERVER_PORT = 3470;
const WS_URL = `ws://localhost:${SERVER_PORT}`;
const TEST_TIMEOUT = 60000;

describe("Tool E2E Test", () => {
  let serverProcess: ReturnType<typeof spawn>;

  beforeAll(async () => {
    const serverPath = join(__dirname, "..", "dist", "server.js");
    serverProcess = spawn("node", [serverPath], {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: "pipe",
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server startup timeout")), 15000);
      serverProcess.stdout?.on("data", (data) => {
        if (data.toString().includes("Pi Gateway Server")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    serverProcess?.kill();
    await new Promise((r) => setTimeout(r, 500));
  });

  it(
    "should complete write tool lifecycle without duplicates",
    async () => {
      const ws = new WebSocket(WS_URL);

      const events: Array<{
        type: string;
        toolCallId?: string;
        toolName?: string;
        timestamp: number;
      }> = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve();
        }, 35000);

        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          const timestamp = Date.now();

          if (
            ["toolcall_delta", "tool_start", "tool_end", "message_start", "message_end"].includes(
              msg.type
            )
          ) {
            events.push({
              type: msg.type,
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              timestamp,
            });
          }

          if (msg.type === "initialized") {
            ws.send(
              JSON.stringify({
                type: "prompt",
                text: "创建一个文件 test_e2e.txt，包含20行数字",
                model: "deepseek/deepseek-chat",
              })
            );
          }

          if (msg.type === "agent_end") {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        });

        ws.on("open", () => {
          ws.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });

        ws.on("error", reject);
      });

      console.log("\n=== Event Timeline ===");
      const startTime = events[0]?.timestamp || 0;
      events.forEach((e, i) => {
        const relTime = e.timestamp - startTime;
        console.log(
          `${i + 1}. [+${relTime}ms] ${e.type} ${e.toolCallId || ""} ${e.toolName || ""}`
        );
      });

      const toolEvents = new Map<string, string[]>();
      for (const e of events) {
        if (e.toolCallId) {
          if (!toolEvents.has(e.toolCallId)) {
            toolEvents.set(e.toolCallId, []);
          }
          toolEvents.get(e.toolCallId)?.push(e.type);
        }
      }

      console.log("\n=== Tool Event Sequences ===");
      for (const [id, types] of toolEvents) {
        console.log(`Tool ${id}: ${types.join(" -> ")}`);
      }

      for (const [id, types] of toolEvents) {
        const deltaCount = types.filter((t) => t === "toolcall_delta").length;
        const startCount = types.filter((t) => t === "tool_start").length;
        const endCount = types.filter((t) => t === "tool_end").length;

        console.log(`\nTool ${id} summary:`);
        console.log(`  toolcall_delta: ${deltaCount}`);
        console.log(`  tool_start: ${startCount}`);
        console.log(`  tool_end: ${endCount}`);

        expect(startCount).toBe(1);
        expect(endCount).toBe(1);

        const firstDelta = types.indexOf("toolcall_delta");
        const startIdx = types.indexOf("tool_start");
        const endIdx = types.indexOf("tool_end");

        expect(firstDelta).toBeGreaterThanOrEqual(0);
        expect(startIdx).toBeGreaterThan(firstDelta);
        expect(endIdx).toBeGreaterThan(startIdx);
      }

      expect(toolEvents.size).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  it(
    "should handle rapid successive tool calls",
    async () => {
      const ws = new WebSocket(WS_URL);

      const toolStarts: Array<{
        toolName: string;
        toolCallId: string;
        timestamp: number;
      }> = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve();
        }, 40000);

        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "tool_start") {
            toolStarts.push({
              toolName: msg.toolName,
              toolCallId: msg.toolCallId,
              timestamp: Date.now(),
            });
          }

          if (msg.type === "initialized") {
            ws.send(
              JSON.stringify({
                type: "prompt",
                text: "创建三个文件：file1.txt写'hello'，file2.txt写'world'，file3.txt写'test'",
                model: "deepseek/deepseek-chat",
              })
            );
          }

          if (msg.type === "agent_end") {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        });

        ws.on("open", () => {
          ws.send(
            JSON.stringify({
              type: "init",
              workingDir: "/root",
            })
          );
        });

        ws.on("error", reject);
      });

      console.log("\n=== Rapid Tool Calls ===");
      console.log(`Total tool_start events: ${toolStarts.length}`);
      toolStarts.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.toolName} (${t.toolCallId})`);
      });

      expect(toolStarts.length).toBeGreaterThan(1);

      const ids = toolStarts.map((t) => t.toolCallId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    },
    TEST_TIMEOUT
  );
});
