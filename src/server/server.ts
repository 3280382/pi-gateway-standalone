#!/usr/bin/env node

/**
 * Pi Gateway Server - Feature-Based 架构版本
 * 重构后的简化 server.ts，使用 WebSocket Router 进行消息分发
 *
 * 架构改进：
 * - 使用 WSRouter 分发 WebSocket 消息（替代 switch/case）
 * - Feature-Based 目录结构
 * - 核心业务逻辑迁移到 features/
 */

// ============================================================================
// 第一步：在导入任何 SDK 之前设置 fetch 拦截器
// ============================================================================

import { Config } from "./config";
import { Logger, LogLevel } from "./lib/utils/logger";
import { setupLlmInterceptors } from "./llm";
import { LlmLogManager } from "./llm/log-manager";

// 全局 LLM 日志管理器
const llmLogManager = new LlmLogManager({
	enabled: Config.getLlmLogConfig().enabled,
	truncateLimit: Config.getLlmLogConfig().truncateLimit,
});

// 设置 LLM 拦截器（必须在导入 pi-coding-agent 之前）
setupLlmInterceptors(llmLogManager, {
	setupHttpInterceptor: true,
	truncateLimit: Config.getLlmLogConfig().truncateLimit,
});

// ============================================================================
// 第二步：导入其他模块
// ============================================================================

import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { registerRoutes } from "./app/registerRoutes";
import { type WSContext, wsRouter } from "./app/registerWS";
import { PiAgentSession } from "./features/chat/agent-session/agentSession";
import { AppFactory } from "./lib/app-factory";

// ============================================================================
// 服务器启动时间用于重新加载检测
// ============================================================================

const SERVER_START_TIME = Date.now();

// ============================================================================
// 全局错误处理器防止崩溃
// ============================================================================

process.on("uncaughtException", (error) => {
	console.error("[FATAL] 未捕获异常:", error);
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("[FATAL] 未处理的 Promise 拒绝:", promise, "原因:", reason);
});

// ============================================================================
// 日志器
// ============================================================================

const logger = new Logger({ level: LogLevel.INFO });

// ============================================================================
// WebSocket 消息验证 Schema
// ============================================================================

const _WebSocketMessageSchema = z.object({
	type: z.string(),
	payload: z.record(z.unknown()).optional(),
});

// ============================================================================
// 创建 Express 应用和服务器
// ============================================================================

const appFactory = AppFactory.createDefault();
const app = appFactory.getApp();
const server = appFactory.getServer();

// ============================================================================
// 注册 API 路由
// ============================================================================

await registerRoutes(app, llmLogManager, SERVER_START_TIME);
appFactory.setupNotFoundHandler();
logger.info("API 路由已注册，404 处理器已设置");

// ============================================================================
// 设置 WebSocket 服务器
// ============================================================================

const wss = new WebSocketServer({ server });

// 连接计数器（用于生成唯一 ID）
let connectionCounter = 0;

wss.on("connection", (ws) => {
	const connectionId = `conn_${++connectionCounter}_${Date.now()}`;
	logger.info(`[WebSocket] 新连接建立: ${connectionId}`);

	// 创建 PiAgentSession 实例
	const piAgentSession = new PiAgentSession(ws, llmLogManager);

	// 创建 WebSocket 上下文
	const ctx: WSContext = {
		ws,
		session: piAgentSession,
		connectionId,
		connectedAt: new Date(),
	};

	// WebSocket 消息处理 - 使用 Router 分发
	ws.on("message", async (data) => {
		let rawMessage: unknown;

		// 1. 解析 JSON
		try {
			rawMessage = JSON.parse(data.toString());
		} catch {
			ws.send(
				JSON.stringify({
					type: "error",
					error: "无效的 JSON 消息",
				}),
			);
			return;
		}

		// 2. 提取 type 和 payload
		let type: string;
		let payload: any;

		if (rawMessage && typeof rawMessage === "object" && "type" in rawMessage) {
			type = (rawMessage as any).type;
			// 将整个对象作为 payload，但排除 type 字段
			const { type: _, ...rest } = rawMessage as any;
			payload = rest;
		} else {
			ws.send(
				JSON.stringify({
					type: "error",
					error: "消息必须包含 type 字段",
				}),
			);
			return;
		}

		// 3. 使用 Router 分发消息
		try {
			await wsRouter.dispatch(type, ctx, payload);
		} catch (error) {
			logger.error(
				`[WebSocket] 处理消息 "${type}" 时出错:`,
				{ rawMessage },
				error instanceof Error ? error : undefined,
			);

			try {
				ws.send(
					JSON.stringify({
						type: "error",
						error: error instanceof Error ? error.message : "处理消息失败",
						receivedType: type,
					}),
				);
			} catch (sendError) {
				logger.error(
					"[WebSocket] 发送错误消息失败:",
					{},
					sendError instanceof Error ? sendError : undefined,
				);
			}
		}
	});

	// 连接关闭处理
	ws.on("close", () => {
		logger.info(`[WebSocket] 连接关闭: ${connectionId}`);
		piAgentSession.dispose();
	});

	// 错误处理
	ws.on("error", (error) => {
		logger.error(`[WebSocket] 连接错误: ${connectionId}`, {}, error);
		piAgentSession.dispose();
	});
});

// ============================================================================
// 优雅关闭处理
// ============================================================================

function setupGracefulShutdown() {
	const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];

	shutdownSignals.forEach((signal) => {
		process.on(signal, async () => {
			logger.info(`收到 ${signal} 信号，正在优雅关闭...`);

			// 关闭 WebSocket 服务器
			if (wss) {
				logger.info("关闭 WebSocket 服务器...");
				wss.clients.forEach((client) => {
					if (client.readyState === WebSocket.OPEN) {
						client.close(1001, "服务器正在关闭");
					}
				});
				wss.close();
			}

			// 清理 LLM 日志管理器
			llmLogManager.dispose();

			// 关闭 HTTP 服务器
			if (server) {
				server.close(() => {
					logger.info("HTTP 服务器已关闭");
					process.exit(0);
				});

				// 强制超时
				setTimeout(() => {
					logger.error("强制关闭超时");
					process.exit(1);
				}, 10000);
			} else {
				process.exit(0);
			}
		});
	});

	logger.info("优雅关闭处理已设置");
}

setupGracefulShutdown();

// ============================================================================
// 启动服务器（仅在直接运行时）
// ============================================================================

const isMainModule =
	import.meta.url.endsWith(process.argv[1]) ||
	process.argv[1]?.includes("server.ts") ||
	process.argv[1]?.includes("server.js");

if (isMainModule) {
	const port = Config.getPort();

	appFactory
		.start()
		.then(() => {
			console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   Pi Gateway Server (Feature-Based 架构)              ║
║                                                        ║
║   Web UI: http://localhost:${port}                      ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
		})
		.catch((error) => {
			console.error("启动服务器失败:", error);
			process.exit(1);
		});
}

// ============================================================================
// 导出（用于测试）
// ============================================================================

export { app, PiAgentSession, llmLogManager, server, wss };
