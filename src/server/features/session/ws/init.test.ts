/**
 * Init Handler 单元测试
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WebSocket } from "ws";
import { handleInit } from "./init";
import type { WSContext } from "../../../shared/websocket/types";

describe("handleInit", () => {
	let mockCtx: WSContext;
	let mockWs: Partial<WebSocket>;
	let mockSession: any;

	beforeEach(() => {
		mockWs = {
			send: vi.fn(),
			readyState: 1,
		};
		mockSession = {
			initialize: vi.fn().mockResolvedValue({
				sessionId: "test-session-123",
				sessionFile: "/path/to/session.jsonl",
				workingDir: "/test/dir",
				model: "deepseek-chat",
			}),
		};
		mockCtx = {
			ws: mockWs as WebSocket,
			session: mockSession,
			connectionId: "test-conn-1",
			connectedAt: new Date(),
		};
	});

	it("should initialize session with workingDir", async () => {
		await handleInit(mockCtx, { workingDir: "/test/dir" });

		expect(mockSession.initialize).toHaveBeenCalledWith("/test/dir", undefined);
	});

	it("should initialize session with sessionId", async () => {
		await handleInit(mockCtx, {
			workingDir: "/test/dir",
			sessionId: "existing-session",
		});

		expect(mockSession.initialize).toHaveBeenCalledWith(
			"/test/dir",
			"existing-session",
		);
	});

	it("should send initialized response on success", async () => {
		await handleInit(mockCtx, { workingDir: "/test/dir" });

		expect(mockWs.send).toHaveBeenCalledWith(
			expect.stringContaining("initialized"),
		);
	});

	it("should include session info in response", async () => {
		await handleInit(mockCtx, { workingDir: "/test/dir" });

		const callArg = (mockWs.send as any).mock.calls[0][0];
		const response = JSON.parse(callArg);

		expect(response.type).toBe("initialized");
		expect(response.sessionId).toBe("test-session-123");
		expect(response.workingDir).toBe("/test/dir");
		expect(response.pid).toBe(process.pid);
	});

	it("should send error on initialization failure", async () => {
		mockSession.initialize = vi
			.fn()
			.mockRejectedValue(new Error("Init failed"));

		await handleInit(mockCtx, { workingDir: "/test/dir" });

		expect(mockWs.send).toHaveBeenCalledWith(
			expect.stringContaining("error"),
		);
	});
});
