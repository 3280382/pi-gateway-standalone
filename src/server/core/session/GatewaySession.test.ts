/**
 * GatewaySession Unit Tests
 * Tests for the core session management functionality
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import type { LlmLogManager } from "../../llm/log-manager";
import { GatewaySession } from "./GatewaySession";

describe("GatewaySession", () => {
	let mockWs: Partial<WebSocket>;
	let mockLlmLogManager: Partial<LlmLogManager>;
	let session: GatewaySession;

	beforeEach(() => {
		mockWs = {
			send: vi.fn(),
			readyState: 1, // WebSocket.OPEN
		};
		mockLlmLogManager = {
			setLogFile: vi.fn(),
			getLogFilePath: vi.fn().mockReturnValue("/path/to/log"),
			setEnabled: vi.fn(),
			dispose: vi.fn(),
		};
		session = new GatewaySession(
			mockWs as WebSocket,
			mockLlmLogManager as LlmLogManager,
		);
	});

	describe("send", () => {
		it("should send message when WebSocket is open", () => {
			const message = { type: "test", data: "hello" };
			session.send(message);

			expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
		});

		it("should not send when WebSocket is not open", () => {
			(mockWs as any).readyState = 3; // WebSocket.CLOSED

			const message = { type: "test", data: "hello" };
			session.send(message);

			expect(mockWs.send).not.toHaveBeenCalled();
		});
	});

	describe("dispose", () => {
		it("should clean up resources", () => {
			session.dispose();

			// After dispose, session should be null
			expect(session.session).toBeNull();
		});
	});

	describe("abort", () => {
		it("should do nothing if session is null", async () => {
			await expect(session.abort()).resolves.not.toThrow();
		});

		it("should call session.abort when session exists", async () => {
			const mockAbort = vi.fn().mockResolvedValue(undefined);
			(session as any).session = { abort: mockAbort };

			await session.abort();

			expect(mockAbort).toHaveBeenCalled();
		});
	});

	describe("newSession", () => {
		it("should do nothing if session is null", async () => {
			await session.newSession();

			expect(mockWs.send).not.toHaveBeenCalled();
		});

		it("should send session_info on success", async () => {
			const mockNewSession = vi.fn().mockResolvedValue(undefined);
			(session as any).session = {
				newSession: mockNewSession,
				sessionId: "new-session-123",
				sessionFile: "/path/to/new.jsonl",
			};

			await session.newSession();

			expect(mockWs.send).toHaveBeenCalledWith(
				expect.stringContaining("session_info"),
			);
		});
	});

	describe("listModels", () => {
		it("should list available models", async () => {
			const mockGetAvailable = vi.fn().mockResolvedValue([
				{ id: "model1", provider: "openai", name: "GPT-4" },
				{ id: "model2", provider: "anthropic", name: "Claude" },
			]);
			(session as any).modelRegistry = {
				getAvailable: mockGetAvailable,
			};

			await session.listModels();

			expect(mockWs.send).toHaveBeenCalledWith(
				expect.stringContaining("models_list"),
			);
		});
	});

	describe("setThinkingLevel", () => {
		it("should do nothing if session is null", async () => {
			await session.setThinkingLevel("medium");

			expect(mockWs.send).not.toHaveBeenCalled();
		});

		it("should set thinking level and send confirmation", async () => {
			const mockSetThinkingLevel = vi.fn();
			(session as any).session = {
				setThinkingLevel: mockSetThinkingLevel,
				thinkingLevel: "medium",
			};

			await session.setThinkingLevel("high");

			expect(mockSetThinkingLevel).toHaveBeenCalledWith("high");
			expect(mockWs.send).toHaveBeenCalledWith(
				expect.stringContaining("thinking_set"),
			);
		});
	});

	describe("setModel", () => {
		it("should do nothing if session is null", async () => {
			await session.setModel("openai", "gpt-4");

			expect(mockWs.send).not.toHaveBeenCalled();
		});

		it("should send error if model not found", async () => {
			(session as any).session = {};
			(session as any).modelRegistry = {
				find: vi.fn().mockReturnValue(null),
			};

			await session.setModel("unknown", "model");

			expect(mockWs.send).toHaveBeenCalledWith(
				expect.stringContaining("error"),
			);
		});
	});
});
