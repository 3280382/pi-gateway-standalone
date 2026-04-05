/**
 * HTTP 路由注册入口
 * 统一的 HTTP 路由注册入口，集中调用各 Feature 的路由注册函数
 */

import type { Application } from "express";
import type { LlmLogManager } from "../features/chat/llm/log-manager";
import { registerChatHTTPRoutes } from "../features/chat/http-routes";
import {
	registerFilesHTTPRoutes,
	registerWorkspaceRoutes,
} from "../features/files/http-routes";

/**
 * 注册所有 HTTP API 路由
 * @param app Express 应用实例
 * @param llmLogManager LLM 日志管理器
 * @param serverStartTime 服务器启动时间
 */
export async function registerRoutes(
	app: Application,
	llmLogManager: LlmLogManager,
	serverStartTime: number,
): Promise<void> {
	// 并行注册各 Feature 的路由
	await Promise.all([
		registerChatHTTPRoutes(app, llmLogManager, serverStartTime),
		registerFilesHTTPRoutes(app),
	]);

	// 同步注册 Workspace 路由
	registerWorkspaceRoutes(app);

	console.log("[API] 所有路由已注册");
}
