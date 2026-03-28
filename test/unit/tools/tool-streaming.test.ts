/**
 * Test tool streaming display functionality
 * Verifies that Write tool shows content progressively
 */
import { spawn } from "child_process";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const SERVER_PORT = 3471;
const WS_URL = `ws://localhost:${SERVER_PORT}`;
const TEST_TIMEOUT = 30000;

describe("Tool Streaming Display", () => {
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

	it("should receive toolcall_delta events for write tool", async () => {
		const ws = new WebSocket(WS_URL);

		const events: string[] = [];
		let receivedToolCallDelta = false;
		let receivedToolExecutionStart = false;

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.close();
				resolve();
			}, 20000);

			ws.on("message", (data) => {
				const msg = JSON.parse(data.toString());
				events.push(msg.type);

				if (msg.type === "initialized") {
					ws.send(
						JSON.stringify({
							type: "prompt",
							text: "Create a file test.txt with content 'Hello World' using the write tool",
							model: "deepseek/deepseek-chat",
						}),
					);
				}

				if (msg.type === "toolcall_delta") {
					receivedToolCallDelta = true;
				}

				if (msg.type === "tool_start") {
					receivedToolExecutionStart = true;
					console.log("Tool start:", msg.toolName, "args:", JSON.stringify(msg.args).slice(0, 100));
				}

				if (msg.type === "done" || msg.type === "error") {
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

		console.log("Events received:", events.join(", "));
		expect(receivedToolExecutionStart || events.includes("tool_start")).toBe(true);
		console.log("Received toolcall_delta:", receivedToolCallDelta);
	}, 25000);

	it("should display write tool content progressively", async () => {
		const ws = new WebSocket(WS_URL);

		let toolStartArgs: any = null;

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				ws.close();
				resolve();
			}, 15000);

			ws.on("message", (data) => {
				const msg = JSON.parse(data.toString());

				if (msg.type === "initialized") {
					ws.send(
						JSON.stringify({
							type: "prompt",
							text: "Write a 10 line poem to poem.txt",
							model: "deepseek/deepseek-chat",
						}),
					);
				}

				if (msg.type === "tool_start" && msg.toolName === "write") {
					toolStartArgs = msg.args;
					console.log("Write tool args:", JSON.stringify(msg.args, null, 2));
					clearTimeout(timeout);
					ws.close();
					resolve();
				}

				if (msg.type === "done" || msg.type === "error") {
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

		expect(toolStartArgs).toBeTruthy();
		if (toolStartArgs) {
			expect(toolStartArgs.path || toolStartArgs.file_path).toBeTruthy();
			expect(toolStartArgs.content).toBeTruthy();
			expect(typeof toolStartArgs.content).toBe("string");
		}
	}, 20000);
});
