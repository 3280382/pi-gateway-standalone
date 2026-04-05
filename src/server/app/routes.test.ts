/**
 * Register Routes 单元测试
 */

import type { Application, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmLogManager } from "../features/chat/llm/log-manager";
import { registerRoutes } from "./routes";

describe("registerRoutes", () => {
	let mockApp: Partial<Application>;
	let mockLlmLogManager: Partial<LlmLogManager>;
	let routes: Map<string, Function>;

	beforeEach(() => {
		routes = new Map();
		mockApp = {
			get: vi.fn((path: string, handler: Function) => {
				routes.set(`GET ${path}`, handler);
			}),
			post: vi.fn((path: string, handler: Function) => {
				routes.set(`POST ${path}`, handler);
			}),
			delete: vi.fn((path: string, handler: Function) => {
				routes.set(`DELETE ${path}`, handler);
			}),
		};
		mockLlmLogManager = {
			getLogFilePath: vi.fn().mockReturnValue("/path/to/log"),
			setEnabled: vi.fn(),
		};
	});

	it("should register all API routes", async () => {
		await registerRoutes(
			mockApp as Application,
			mockLlmLogManager as LlmLogManager,
			Date.now(),
		);

		// Check version/status routes
		expect(routes.has("GET /api/version")).toBe(true);
		expect(routes.has("GET /api/health")).toBe(true);
		expect(routes.has("GET /api/ready")).toBe(true);
		expect(routes.has("GET /api/status")).toBe(true);

		// Check model routes
		expect(routes.has("GET /api/models")).toBe(true);
		expect(routes.has("POST /api/models")).toBe(true);

		// Check session routes
		expect(routes.has("GET /api/sessions")).toBe(true);
		expect(routes.has("POST /api/session/load")).toBe(true);
		expect(routes.has("GET /api/system-prompt")).toBe(true);

		// Check file routes
		expect(routes.has("POST /api/browse")).toBe(true);
		expect(routes.has("GET /api/files/tree")).toBe(true);
		expect(routes.has("GET /api/files/content")).toBe(true);
		expect(routes.has("POST /api/files/write")).toBe(true);
		expect(routes.has("POST /api/files/batch-delete")).toBe(true);
		expect(routes.has("POST /api/files/batch-move")).toBe(true);
		expect(routes.has("POST /api/execute")).toBe(true);

		// Check workspace routes
		expect(routes.has("GET /api/workspace/current")).toBe(true);
		expect(routes.has("GET /api/working-dir")).toBe(true);
		expect(routes.has("GET /api/workspace/recent")).toBe(true);
		expect(routes.has("POST /api/workspace/recent")).toBe(true);
		expect(routes.has("DELETE /api/workspace/recent")).toBe(true);
	}, 10000);

	it("should return settings on GET /api/settings", async () => {
		await registerRoutes(
			mockApp as Application,
			mockLlmLogManager as LlmLogManager,
			Date.now(),
		);

		const handler = routes.get("GET /api/settings");
		const mockRes = {
			json: vi.fn(),
		};

		handler?.({} as Request, mockRes as Response);

		expect(mockRes.json).toHaveBeenCalledWith({
			theme: "dark",
			fontSize: "small",
			showThinking: true,
			language: "zh-CN",
		});
	});
});
