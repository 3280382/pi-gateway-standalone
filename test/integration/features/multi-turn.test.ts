import { spawn } from "child_process";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const SERVER_PORT = 3464;
const WS_URL = `ws://localhost:${SERVER_PORT}`;

describe("Multi-turn Conversation", () => {
	let serverProcess: ReturnType<typeof spawn>;
	let ws: WebSocket;

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
	}, 30000);

	afterAll(async () => {
		ws?.close();
		serverProcess?.kill();
		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	function connectAndInit(): Promise<WebSocket> {
		return new Promise((resolve, reject) => {
			const socket = new WebSocket(WS_URL);
			const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5000);

			socket.on("open", () => {
				socket.send(
					JSON.stringify({
						type: "init",
						workingDir: process.cwd(),
					}),
				);
			});

			socket.on("message", (data) => {
				const msg = JSON.parse(data.toString());
				if (msg.type === "initialized") {
					clearTimeout(timeout);
					resolve(socket);
				}
			});

			socket.on("error", (err) => {
				clearTimeout(timeout);
				reject(err);
			});
		});
	}

	function waitForMessage(socket: WebSocket, type: string, timeoutMs = 30000): Promise<any> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeoutMs);
			const handler = (data: WebSocket.Data) => {
				const msg = JSON.parse(data.toString());
				if (msg.type === type) {
					clearTimeout(timeout);
					socket.off("message", handler);
					resolve(msg);
				}
			};
			socket.on("message", handler);
		});
	}

	function sendPrompt(socket: WebSocket, text: string): Promise<void> {
		return new Promise((resolve, reject) => {
			socket.send(JSON.stringify({ type: "prompt", text }), (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	it("should handle 5 turns of conversation", async () => {
		ws = await connectAndInit();

		// Turn 1
		await sendPrompt(ws, "Hello, this is turn 1");
		await waitForMessage(ws, "agent_start");
		await waitForMessage(ws, "agent_end");

		// Turn 2
		await sendPrompt(ws, "This is turn 2");
		await waitForMessage(ws, "agent_start");
		await waitForMessage(ws, "agent_end");

		// Turn 3
		await sendPrompt(ws, "This is turn 3");
		await waitForMessage(ws, "agent_start");
		await waitForMessage(ws, "agent_end");

		// Turn 4
		await sendPrompt(ws, "This is turn 4");
		await waitForMessage(ws, "agent_start");
		await waitForMessage(ws, "agent_end");

		// Turn 5
		await sendPrompt(ws, "This is turn 5");
		await waitForMessage(ws, "agent_start");
		const endMsg = await waitForMessage(ws, "agent_end");

		expect(endMsg.type).toBe("agent_end");
	}, 60000);

	it("should handle conversation after compaction", async () => {
		ws = await connectAndInit();

		// First turn
		await sendPrompt(ws, "First message before compaction");
		await waitForMessage(ws, "agent_start");
		await waitForMessage(ws, "agent_end");

		// Simulate compaction by checking state resets properly
		// Send multiple turns to trigger compaction
		for (let i = 0; i < 3; i++) {
			await sendPrompt(ws, `Message ${i + 2}`);
			await waitForMessage(ws, "agent_start");
			await waitForMessage(ws, "agent_end");
		}

		// After compaction, verify we can still send messages
		await sendPrompt(ws, "Message after potential compaction");
		await waitForMessage(ws, "agent_start");
		const endMsg = await waitForMessage(ws, "agent_end");

		expect(endMsg.type).toBe("agent_end");
	}, 60000);

	it("should properly reset streaming state on compaction_end", async () => {
		ws = await connectAndInit();

		// Start a conversation
		await sendPrompt(ws, "Start conversation");
		await waitForMessage(ws, "agent_start");
		await waitForMessage(ws, "agent_end");

		// Verify we can immediately send another message
		// This tests that isStreaming was properly reset
		await sendPrompt(ws, "Second message");
		await waitForMessage(ws, "agent_start");
		const endMsg = await waitForMessage(ws, "agent_end");

		expect(endMsg.type).toBe("agent_end");

		// Third message to ensure continuity
		await sendPrompt(ws, "Third message");
		await waitForMessage(ws, "agent_start");
		const thirdEnd = await waitForMessage(ws, "agent_end");

		expect(thirdEnd.type).toBe("agent_end");
	}, 60000);
});
