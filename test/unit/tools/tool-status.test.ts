/**
 * Test tool status display updates correctly
 */
import { spawn } from "child_process";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const SERVER_PORT = 3467;
const _SERVER_URL = `http://localhost:${SERVER_PORT}`;
const WS_URL = `ws://localhost:${SERVER_PORT}`;
const TEST_TIMEOUT = 60000;

describe("Tool Status Display", () => {
	let serverProcess: ReturnType<typeof spawn>;

	beforeAll(async () => {
		// Start server
		const serverPath = join(__dirname, "..", "dist", "server.js");
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
	}, TEST_TIMEOUT);

	afterAll(async () => {
		serverProcess?.kill();
		await new Promise((r) => setTimeout(r, 500));
	});

	it(
		"should receive tool_end event after tool_start",
		async () => {
			const wsUrl = WS_URL!.replace("http://", "ws://");
			const ws = new WebSocket(wsUrl);

			const events: Array<{
				type: string;
				toolCallId?: string;
				timestamp: number;
			}> = [];

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					ws.close();
					resolve();
				}, 30000);

				ws.on("message", (data) => {
					const msg = JSON.parse(data.toString());

					if (["tool_start", "tool_end"].includes(msg.type)) {
						events.push({
							type: msg.type,
							toolCallId: msg.toolCallId,
							timestamp: Date.now(),
						});
					}

					if (msg.type === "initialized") {
						ws.send(
							JSON.stringify({
								type: "prompt",
								text: "创建一个文件 test_status.txt，写一行文字",
								model: "deepseek/deepseek-chat",
							}),
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
						}),
					);
				});

				ws.on("error", reject);
			});

			console.log("\n=== Tool Status Events ===");
			events.forEach((e, i) => {
				console.log(`${i + 1}. ${e.type} - ${e.toolCallId}`);
			});

			// Should have tool_start and tool_end
			const toolStarts = events.filter((e) => e.type === "tool_start");
			const toolEnds = events.filter((e) => e.type === "tool_end");

			console.log(`\ntool_start: ${toolStarts.length}`);
			console.log(`tool_end: ${toolEnds.length}`);

			// Verify each tool_start has a corresponding tool_end
			for (const start of toolStarts) {
				const endIndex = events.findIndex((e) => e.type === "tool_end" && e.toolCallId === start.toolCallId);
				const startIndex = events.indexOf(start);
				console.log(`Tool ${start.toolCallId}: start at ${startIndex}, end at ${endIndex}`);
				expect(endIndex).toBeGreaterThan(startIndex);
			}

			expect(toolStarts.length).toBeGreaterThan(0);
			expect(toolEnds.length).toBe(toolStarts.length);
		},
		TEST_TIMEOUT,
	);
});
