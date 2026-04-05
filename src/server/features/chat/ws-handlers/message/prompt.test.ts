/**
 * Prompt Handler 单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import type { WSContext } from "../../ws-router";
import { handlePrompt } from "./prompt";

describe("handlePrompt", () => {
	let mockCtx: WSContext;
	let mockWs: Partial<WebSocket>;
	let mockSession: any;

	beforeEach(() => {
		mockWs = {
			send: vi.fn(),
			readyState: 1,
		};
		// GatewaySession has prompt method directly and session property with AgentSession
		mockSession = {
			session: {}, // AgentSession object
			isStreaming: false,
			prompt: vi.fn().mockResolvedValue(undefined),
		};
		mockCtx = {
			ws: mockWs as WebSocket,
			session: mockSession,
			connectionId: "test-conn-1",
			connectedAt: new Date(),
		};
	});

	it("should send error if session not initialized", async () => {
		mockCtx.session.session = null;

		await handlePrompt(mockCtx, { text: "Hello" });

		expect(mockWs.send).toHaveBeenCalledWith(
			JSON.stringify({
				type: "error",
				error: "会话未初始化，请先发送 init 消息",
			}),
		);
	});

	it("should call session.prompt with text", async () => {
		await handlePrompt(mockCtx, { text: "Hello AI" });

		expect(mockSession.prompt).toHaveBeenCalledWith("Hello AI", undefined);
	});

	it("should call session.prompt with images", async () => {
		const images = [
			{
				type: "image" as const,
				source: {
					type: "base64" as const,
					mediaType: "image/png",
					data: "base64data",
				},
			},
		];

		await handlePrompt(mockCtx, { text: "Describe this", images });

		expect(mockSession.prompt).toHaveBeenCalledWith("Describe this", images);
	});

	it("should handle streaming mode", async () => {
		mockCtx.session.isStreaming = true;

		await handlePrompt(mockCtx, { text: "Hello" });

		expect(mockSession.prompt).toHaveBeenCalledWith("Hello", undefined);
	});
});
