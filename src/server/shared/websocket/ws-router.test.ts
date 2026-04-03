/**
 * WebSocket Router 单元测试
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WebSocket } from "ws";
import { WSRouter, wsRouter } from "./ws-router";
import type { WSContext } from "./types";

describe("WSRouter", () => {
	let router: WSRouter;
	let mockCtx: WSContext;
	let mockWs: Partial<WebSocket>;

	beforeEach(() => {
		router = new WSRouter();
		mockWs = {
			send: vi.fn(),
			readyState: 1, // OPEN
		};
		mockCtx = {
			ws: mockWs as WebSocket,
			session: {} as any,
			connectionId: "test-conn-1",
			connectedAt: new Date(),
		};
	});

	describe("register", () => {
		it("should register a handler for a message type", () => {
			const handler = vi.fn();
			router.register("test", handler);

			expect(router.has("test")).toBe(true);
		});

		it("should overwrite existing handler", () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();

			router.register("test", handler1);
			router.register("test", handler2);

			expect(router.has("test")).toBe(true);
		});
	});

	describe("unregister", () => {
		it("should remove a registered handler", () => {
			router.register("test", vi.fn());
			router.unregister("test");

			expect(router.has("test")).toBe(false);
		});
	});

	describe("dispatch", () => {
		it("should call the registered handler", async () => {
			const handler = vi.fn().mockResolvedValue(undefined);
			router.register("test", handler);

			const payload = { data: "test" };
			await router.dispatch("test", mockCtx, payload);

			expect(handler).toHaveBeenCalledWith(mockCtx, payload);
		});

		it("should return error for unknown message type", async () => {
			await router.dispatch("unknown", mockCtx, {});

			expect(mockWs.send).toHaveBeenCalledWith(
				JSON.stringify({
					type: "error",
					error: "未知的消息类型: unknown",
				}),
			);
		});

		it("should handle async handlers", async () => {
			const handler = vi.fn().mockResolvedValue(undefined);
			router.register("async_test", handler);

			await router.dispatch("async_test", mockCtx, {});

			expect(handler).toHaveBeenCalled();
		});

		it("should handle handler errors", async () => {
			const error = new Error("Handler error");
			const handler = vi.fn().mockRejectedValue(error);
			router.register("error_test", handler);

			await router.dispatch("error_test", mockCtx, {});

			expect(mockWs.send).toHaveBeenCalledWith(
				expect.stringContaining("Handler error"),
			);
		});
	});

	describe("getRegisteredTypes", () => {
		it("should return all registered types", () => {
			router.register("type1", vi.fn());
			router.register("type2", vi.fn());
			router.register("type3", vi.fn());

			const types = router.getRegisteredTypes();

			expect(types).toContain("type1");
			expect(types).toContain("type2");
			expect(types).toContain("type3");
		});
	});

	describe("global instance", () => {
		it("should have a global wsRouter instance", () => {
			expect(wsRouter).toBeInstanceOf(WSRouter);
		});
	});
});
