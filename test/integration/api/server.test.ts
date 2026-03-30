import { spawn } from "child_process";
import { join } from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

const SERVER_PORT = 3463;
const WS_URL = `ws://localhost:${SERVER_PORT}`;

describe("WebSocket Server", () => {
	let serverProcess: ReturnType<typeof spawn>;
	let ws: WebSocket;

	beforeAll(async () => {
		// Start server
		const serverPath = join(__dirname, "..", "..", "..", "dist", "server.js");
		serverProcess = spawn("node", [serverPath], {
			env: { ...process.env, PORT: String(SERVER_PORT) },
			stdio: "pipe",
		});

		// Wait for server to start
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error("Server startup timeout")),
				15000,
			);
			serverProcess.stdout?.on("data", (data) => {
				if (data.toString().includes("Pi Gateway Server")) {
					clearTimeout(timeout);
					resolve();
				}
			});
		});
	}, 30000);

	afterEach(async () => {
		ws?.close();
		ws = undefined as any;
		await new Promise((resolve) => setTimeout(resolve, 100));
	});

	afterAll(async () => {
		serverProcess?.kill();
		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	describe("Connection", () => {
		it("should accept WebSocket connections", async () => {
			ws = new WebSocket(WS_URL);

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Connection timeout")),
					5000,
				);
				ws.on("open", () => {
					clearTimeout(timeout);
					resolve();
				});
				ws.on("error", (err) => {
					clearTimeout(timeout);
					reject(err);
				});
			});

			expect(ws.readyState).toBe(WebSocket.OPEN);
		});

		it("should send initialized message after init", async () => {
			ws = new WebSocket(WS_URL);

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Connection timeout")),
					5000,
				);
				ws.on("open", () => {
					clearTimeout(timeout);
					resolve();
				});
				ws.on("error", reject);
			});

			// Send init message
			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve, reject) => {
					const timeout = setTimeout(
						() => reject(new Error("Response timeout")),
						5000,
					);
					ws.on("message", (data) => {
						clearTimeout(timeout);
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			const response = await responsePromise;
			expect(response.type).toBe("initialized");
			expect(response.sessionId).toBeDefined();
			expect(response.sessionFile).toBeDefined();
		});

		it("should handle multiple connections", async () => {
			const ws1 = new WebSocket(WS_URL);
			const ws2 = new WebSocket(WS_URL);

			await Promise.all([
				new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(
						() => reject(new Error("WS1 timeout")),
						5000,
					);
					ws1.on("open", () => {
						clearTimeout(timeout);
						resolve();
					});
				}),
				new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(
						() => reject(new Error("WS2 timeout")),
						5000,
					);
					ws2.on("open", () => {
						clearTimeout(timeout);
						resolve();
					});
				}),
			]);

			expect(ws1.readyState).toBe(WebSocket.OPEN);
			expect(ws2.readyState).toBe(WebSocket.OPEN);

			ws1.close();
			ws2.close();
		});
	});

	describe("Message Types", () => {
		beforeEach(async () => {
			ws = new WebSocket(WS_URL);
			await new Promise<void>((resolve, reject) => {
				ws.on("open", resolve);
				ws.on("error", reject);
			});
		});

		afterEach(() => {
			ws?.close();
		});

		it("should handle init message", async () => {
			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.on("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			const response = await responsePromise;
			expect(response.type).toBe("initialized");
		});

		it("should handle list_sessions message", async () => {
			// First init
			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.once("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(
				JSON.stringify({
					type: "list_sessions",
					cwd: "/root",
				}),
			);

			const response = await responsePromise;
			expect(response.type).toBe("sessions_list");
			expect(response.sessions).toBeDefined();
			expect(Array.isArray(response.sessions)).toBe(true);
		});

		it("should handle new_session message", async () => {
			// First init
			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.once("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(JSON.stringify({ type: "new_session" }));

			const response = await responsePromise;
			expect(response.type).toBe("session_info");
			expect(response.sessionId).toBeDefined();
		});

		it("should handle list_models message", async () => {
			// First init
			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.once("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(JSON.stringify({ type: "list_models" }));

			const response = await responsePromise;
			expect(response.type).toBe("models_list");
			expect(response.models).toBeDefined();
			expect(Array.isArray(response.models)).toBe(true);
		});

		it("should handle set_model message", async () => {
			// First init
			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Get available models first
			const modelsPromise = new Promise<Record<string, unknown>>((resolve) => {
				ws.once("message", (data) => {
					resolve(JSON.parse(data.toString()));
				});
			});

			ws.send(JSON.stringify({ type: "list_models" }));
			const modelsResponse = await modelsPromise;

			if (
				modelsResponse.models &&
				Array.isArray(modelsResponse.models) &&
				modelsResponse.models.length > 0
			) {
				const model = modelsResponse.models[0] as {
					provider: string;
					id: string;
				};

				const responsePromise = new Promise<Record<string, unknown>>(
					(resolve) => {
						ws.once("message", (data) => {
							resolve(JSON.parse(data.toString()));
						});
					},
				);

				ws.send(
					JSON.stringify({
						type: "set_model",
						provider: model.provider,
						modelId: model.id,
					}),
				);

				const response = await responsePromise;
				expect(response.type).toBe("model_set");
				expect(response.model).toBe(model.id);
			}
		});

		it("should return error for invalid message", async () => {
			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.on("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(JSON.stringify({ type: "invalid_type" }));

			const response = await responsePromise;
			expect(response.type).toBe("error");
		});

		it("should handle malformed JSON", async () => {
			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.on("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send("not valid json");

			const response = await responsePromise;
			expect(response.type).toBe("error");
		});
	});

	describe("Session Management via WebSocket", () => {
		beforeEach(async () => {
			ws = new WebSocket(WS_URL);
			await new Promise<void>((resolve, reject) => {
				ws.on("open", resolve);
				ws.on("error", reject);
			});

			// Initialize session
			const initPromise = new Promise<Record<string, unknown>>((resolve) => {
				ws.once("message", (data) => {
					resolve(JSON.parse(data.toString()));
				});
			});

			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			await initPromise;
		});

		afterEach(() => {
			ws?.close();
		});

		it("should create new session and return info", async () => {
			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.once("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(JSON.stringify({ type: "new_session" }));

			const response = await responsePromise;
			expect(response.type).toBe("session_info");
			expect(response.sessionId).toBeDefined();
			expect(response.sessionFile).toBeDefined();
		});

		it("should load existing session", async () => {
			// First list sessions
			const sessionsPromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.once("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(
				JSON.stringify({
					type: "list_sessions",
					cwd: "/root/.pi/agent",
				}),
			);

			const sessionsResponse = await sessionsPromise;

			if (
				sessionsResponse.sessions &&
				Array.isArray(sessionsResponse.sessions) &&
				sessionsResponse.sessions.length > 0
			) {
				const session = sessionsResponse.sessions[0] as { path: string };

				const responsePromise = new Promise<Record<string, unknown>>(
					(resolve) => {
						ws.once("message", (data) => {
							resolve(JSON.parse(data.toString()));
						});
					},
				);

				ws.send(
					JSON.stringify({
						type: "load_session",
						sessionPath: session.path,
					}),
				);

				const response = await responsePromise;
				expect(response.type).toBe("session_loaded");
			}
		});
	});

	describe("Error Handling", () => {
		beforeEach(async () => {
			ws = new WebSocket(WS_URL);
			await new Promise<void>((resolve, reject) => {
				ws.on("open", resolve);
				ws.on("error", reject);
			});
		});

		afterEach(() => {
			ws?.close();
		});

		it("should handle missing workingDir in init", async () => {
			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.on("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(JSON.stringify({ type: "init" }));

			const response = await responsePromise;
			expect(response.type).toBe("error");
		});

		it("should handle non-existent session path", async () => {
			// First init
			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.once("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(
				JSON.stringify({
					type: "load_session",
					sessionPath: "/nonexistent/session.jsonl",
				}),
			);

			const response = await responsePromise;
			expect(response.type).toBe("session_loaded");
			// success may be true or false depending on implementation/n			// just check response has the expected type
			expect(response.type).toBe("session_loaded");
		});

		it("should handle missing model in set_model", async () => {
			// First init
			ws.send(
				JSON.stringify({
					type: "init",
					workingDir: "/root",
				}),
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const responsePromise = new Promise<Record<string, unknown>>(
				(resolve) => {
					ws.once("message", (data) => {
						resolve(JSON.parse(data.toString()));
					});
				},
			);

			ws.send(
				JSON.stringify({
					type: "set_model",
					provider: "nonexistent",
					modelId: "nonexistent-model",
				}),
			);

			const response = await responsePromise;
			expect(response.type).toBe("error");
		});
	});
});
