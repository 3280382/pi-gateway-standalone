/**
 * Integration test for tool display - verifies frontend correctly handles
 * toolcall_delta and tool_start without creating duplicate tools
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const SERVER_PORT = 3469;
const WS_URL = `ws://localhost:${SERVER_PORT}`;
const TEST_TIMEOUT = 60000;

describe("Tool Display Integration", () => {
  let serverProcess: ReturnType<typeof spawn>;

  beforeAll(async () => {
    const serverPath = join(__dirname, "..", "..", "..", "dist", "server.js");
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
    "should receive correct sequence of tool events",
    async () => {
      const ws = new WebSocket(WS_URL);

      const events: Array<{
        type: string;
        toolCallId?: string;
        toolName?: string;
        hasArgs?: boolean;
      }> = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve();
        }, 30000);

        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (
            msg.type === "toolcall_delta" ||
            msg.type === "tool_start" ||
            msg.type === "tool_end"
          ) {
            events.push({
              type: msg.type,
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              hasArgs: !!msg.args,
            });
          }

          if (msg.type === "initialized") {
            ws.send(
              JSON.stringify({
                type: "prompt",
                text: "创建一个文件 test_output.txt，内容包含1到50的数字，每行一个数字",
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

      console.log("\n=== Tool Event Sequence ===");
      events.forEach((e, i) => {
        console.log(
          `${i + 1}. ${e.type} | tool: ${e.toolName} | id: ${e.toolCallId?.slice(0, 20)}... | hasArgs: ${e.hasArgs}`
        );
      });

      const eventsByTool = new Map<string, string[]>();
      for (const e of events) {
        if (e.toolCallId) {
          if (!eventsByTool.has(e.toolCallId)) {
            eventsByTool.set(e.toolCallId, []);
          }
          eventsByTool.get(e.toolCallId)?.push(e.type);
        }
      }

      console.log("\n=== Events by Tool Call ID ===");
      for (const [id, types] of eventsByTool) {
        console.log(`Tool ${id.slice(0, 20)}...: ${types.join(" -> ")}`);
      }

      for (const [_id, types] of eventsByTool) {
        expect(types).toContain("tool_start");
        expect(types).toContain("tool_end");

        const startCount = types.filter((t) => t === "tool_start").length;
        expect(startCount).toBe(1);

        const endCount = types.filter((t) => t === "tool_end").length;
        expect(endCount).toBe(1);

        const startIdx = types.indexOf("tool_start");
        const endIdx = types.indexOf("tool_end");
        expect(startIdx).toBeLessThan(endIdx);
      }

      expect(eventsByTool.size).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );

  it(
    "should handle multiple tools in sequence",
    async () => {
      const ws = new WebSocket(WS_URL);

      const toolEvents: Array<{
        type: string;
        toolName: string;
        toolCallId: string;
      }> = [];

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve();
        }, 45000);

        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());

          if (msg.type === "tool_start" || msg.type === "tool_end") {
            toolEvents.push({
              type: msg.type,
              toolName: msg.toolName,
              toolCallId: msg.toolCallId,
            });
          }

          if (msg.type === "initialized") {
            ws.send(
              JSON.stringify({
                type: "prompt",
                text: "先创建一个文件 file1.txt 写 'hello'，然后再创建一个文件 file2.txt 写 'world'",
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

      console.log("\n=== Multiple Tools Test ===");
      console.log("Tool events:", toolEvents.map((e) => `${e.type}:${e.toolName}`).join(", "));

      const writeTools = toolEvents.filter(
        (e) => e.toolName === "write" && e.type === "tool_start"
      );
      console.log(`Write tool calls: ${writeTools.length}`);

      expect(writeTools.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );
});
