/**
 * Test tool display flow - ensures toolcall_delta and tool_start are properly coordinated
 */
import { spawn } from "child_process";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const SERVER_PORT = 3468;
const WS_URL = `ws://localhost:${SERVER_PORT}`;
const TEST_TIMEOUT = 60000;

describe("Tool Display Flow", () => {
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
		"should show single tool for write operation",
		async () => {
			const ws = new WebSocket(WS_URL);

			const events: any[] = [];
			const toolEvents: Map<string, string[]> = new Map();

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					ws.close();
					resolve();
				}, 30000);

				ws.on("message", (data) => {
					const msg = JSON.parse(data.toString());
					events.push({ type: msg.type, time: Date.now() });

					// Track tool-related events by toolCallId
					if (msg.toolCallId) {
						if (!toolEvents.has(msg.toolCallId)) {
							toolEvents.set(msg.toolCallId, []);
						}
						toolEvents.get(msg.toolCallId)!.push(msg.type);
					}

					if (msg.type === "initialized") {
						ws.send(
							JSON.stringify({
								type: "prompt",
								text: "写一个文件，每行是行数，100行。",
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

				ws.on("error", (err) => {
					clearTimeout(timeout);
					reject(err);
				});
			});

			console.log("Events received:", events.map((e) => e.type).join(", "));
			console.log("Tool events by ID:");
			for (const [id, types] of toolEvents) {
				console.log(`  ${id}: ${types.join(" -> ")}`);
			}

			for (const [toolCallId, types] of toolEvents) {
				const deltaIndex = types.indexOf("toolcall_delta");
				const startIndex = types.indexOf("tool_start");

				if (deltaIndex >= 0 && startIndex >= 0) {
					expect(deltaIndex).toBeLessThan(startIndex);
					console.log(`✓ Tool ${toolCallId}: toolcall_delta comes before tool_start`);
				}

				const startCount = types.filter((t) => t === "tool_start").length;
				expect(startCount).toBeLessThanOrEqual(1);
				console.log(`✓ Tool ${toolCallId}: has ${startCount} tool_start event(s)`);
			}

			const writeToolEvents = Array.from(toolEvents.entries()).find(([_id, types]) =>
				types.some((t) => t.includes("write")),
			);

			if (writeToolEvents) {
				const [id, types] = writeToolEvents;
				console.log(`Write tool ${id} events:`, types);
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"should stream tool arguments progressively",
		async () => {
			const ws = new WebSocket(WS_URL);

			const deltas: string[] = [];
			let finalArgs: any = null;

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					ws.close();
					resolve();
				}, 30000);

				ws.on("message", (data) => {
					const msg = JSON.parse(data.toString());

					if (msg.type === "toolcall_delta") {
						deltas.push(msg.delta);
						if (msg.args) {
							finalArgs = msg.args;
						}
					}

					if (msg.type === "initialized") {
						ws.send(
							JSON.stringify({
								type: "prompt",
								text: "创建一个包含100行的文件。",
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

			console.log(`Received ${deltas.length} deltas`);
			console.log("Final args:", finalArgs);

			expect(deltas.length).toBeGreaterThan(0);
			if (finalArgs?.content) {
				expect(finalArgs.content.length).toBeGreaterThan(0);
			}
		},
		TEST_TIMEOUT,
	);
});
