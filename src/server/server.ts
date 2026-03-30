#!/usr/bin/env node

/**
 * Pi Gateway Server - 模块化架构版本
 * 完整替换原始server.ts的现代实现
 */

// ============================================================================
// 重要：在导入任何SDK之前设置fetch拦截器
// 这确保SDK使用被拦截的fetch
// ============================================================================

import { z } from "zod";
import { Config } from "./config";
import { AppFactory } from "./lib/app-factory";
import { Logger, LogLevel } from "./lib/utils/logger";
import { setupLlmInterceptors } from "./llm";
import { LlmLogManager } from "./llm/log-manager";
import { registerRoutes } from "./routes";
import { GatewaySession } from "./session/gateway-session";

// ============================================================================
// 服务器启动时间用于重新加载检测
// ============================================================================

const SERVER_START_TIME = Date.now();

// ============================================================================
// 全局错误处理器防止崩溃
// ============================================================================

process.on("uncaughtException", (error) => {
	console.error("[FATAL] 未捕获异常:", error);
	// 保持进程活动但记录错误
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("[FATAL] 未处理的Promise拒绝:", promise, "原因:", reason);
	// 保持进程活动但记录错误
});

// ============================================================================
// LLM日志管理器和拦截器设置
// ============================================================================

// 全局LLM日志管理器
const llmLogManager = new LlmLogManager({
	enabled: Config.getLlmLogConfig().enabled,
	truncateLimit: Config.getLlmLogConfig().truncateLimit,
});

// 设置LLM拦截器
setupLlmInterceptors(llmLogManager, {
	setupHttpInterceptor: true,
	truncateLimit: Config.getLlmLogConfig().truncateLimit,
});

// ============================================================================
// 现在导入SDK（它们将使用被拦截的fetch）
// ============================================================================

import { WebSocket, WebSocketServer } from "ws";

// ============================================================================
// WebSocket消息模式定义（与前端兼容）
// ============================================================================

const MessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("init"),
		workingDir: z.string(),
		sessionId: z.string().optional(),
	}),
	z.object({
		type: z.literal("prompt"),
		text: z.string(),
		images: z
			.array(
				z.object({
					type: z.literal("image"),
					source: z.object({
						type: z.literal("base64"),
						mediaType: z.string(),
						data: z.string(),
					}),
				}),
			)
			.optional(),
	}),
	z.object({
		type: z.literal("steer"),
		text: z.string(),
	}),
	z.object({
		type: z.literal("abort"),
	}),
	z.object({
		type: z.literal("new_session"),
	}),
	z.object({
		type: z.literal("list_sessions"),
		cwd: z.string(),
	}),
	z.object({
		type: z.literal("load_session"),
		sessionPath: z.string(),
	}),
	z.object({
		type: z.literal("set_model"),
		provider: z.string(),
		modelId: z.string(),
		thinkingLevel: z
			.enum(["off", "minimal", "low", "medium", "high", "xhigh"])
			.optional(),
	}),
	z.object({
		type: z.literal("list_models"),
	}),
	z.object({
		type: z.literal("command"),
		text: z.string(),
	}),
	z.object({
		type: z.literal("tool_request"),
		toolName: z.string(),
		args: z.record(z.unknown()),
		toolCallId: z.string(),
	}),
	z.object({
		type: z.literal("model_change"),
		provider: z.string(),
		modelId: z.string(),
	}),
	z.object({
		type: z.literal("thinking_level_change"),
		thinkingLevel: z.enum(["off", "minimal", "low", "medium", "high", "xhigh"]),
	}),
	z.object({
		type: z.literal("set_llm_log"),
		enabled: z.boolean(),
	}),
	z.object({
		type: z.literal("change_dir"),
		path: z.string(),
	}),
]);

// ============================================================================
// 创建Express应用和服务器
// ============================================================================

const logger = new Logger({ level: LogLevel.INFO });
const appFactory = AppFactory.createDefault();
const app = appFactory.getApp();
const server = appFactory.getServer();

// ============================================================================
// 注册API路由
// ============================================================================

registerRoutes(app, llmLogManager, SERVER_START_TIME);
appFactory.setupNotFoundHandler();
logger.info("API路由已注册，404处理器已设置");

// ============================================================================
// 设置WebSocket服务器
// ============================================================================

const wss = new WebSocketServer({ server });

// WebSocket连接处理
wss.on("connection", (ws) => {
	logger.info("新的WebSocket连接建立");
	const gatewaySession = new GatewaySession(ws, llmLogManager);

	ws.on("message", async (data) => {
		let rawMessage: unknown;
		try {
			rawMessage = JSON.parse(data.toString());
		} catch {
			ws.send(
				JSON.stringify({
					type: "error",
					error: "无效的JSON消息",
				}),
			);
			return;
		}

		try {
			const message = MessageSchema.parse(rawMessage);

			switch (message.type) {
				case "init": {
					const info = await gatewaySession.initialize(
						message.workingDir,
						message.sessionId,
					);
					ws.send(
						JSON.stringify({
							type: "initialized",
							...info,
							pid: process.pid,
						}),
					);
					break;
				}
				case "prompt": {
					await gatewaySession.prompt(message.text, message.images);
					break;
				}
				case "steer": {
					await gatewaySession.steer(message.text);
					break;
				}
				case "abort": {
					await gatewaySession.abort();
					break;
				}
				case "new_session": {
					await gatewaySession.newSession();
					break;
				}
				case "list_sessions": {
					await gatewaySession.listSessions(message.cwd);
					break;
				}
				case "load_session": {
					await gatewaySession.loadSession(message.sessionPath);
					break;
				}
				case "set_model": {
					await gatewaySession.setModel(
						message.provider,
						message.modelId,
						message.thinkingLevel,
					);
					break;
				}
				case "list_models": {
					await gatewaySession.listModels();
					break;
				}
				case "command": {
					await gatewaySession.executeCommand(message.text);
					break;
				}
				case "tool_request": {
					await gatewaySession.executeTool(
						message.toolName,
						message.args,
						message.toolCallId,
					);
					break;
				}
				case "model_change": {
					await gatewaySession.setModel(message.provider, message.modelId);
					break;
				}
				case "thinking_level_change": {
					await gatewaySession.setThinkingLevel(message.thinkingLevel);
					break;
				}
				case "set_llm_log": {
					llmLogManager.setEnabled(message.enabled);
					logger.info(`LLM日志 ${message.enabled ? "启用" : "禁用"}`);
					ws.send(
						JSON.stringify({
							type: "llm_log_set",
							enabled: message.enabled,
						}),
					);
					break;
				}
				case "change_dir": {
					try {
						// Re-initialize session with new working directory
						const info = await gatewaySession.initialize(message.path);
						ws.send(
							JSON.stringify({
								type: "dir_changed",
								cwd: info.workingDir,
								sessionId: info.sessionId,
								sessionFile: info.sessionFile,
								pid: process.pid,
							}),
						);
						logger.info(`工作目录已更改: ${message.path}`);
					} catch (error) {
						logger.error(
							`更改工作目录失败: ${error instanceof Error ? error.message : String(error)}`,
						);
						ws.send(
							JSON.stringify({
								type: "error",
								error:
									error instanceof Error
										? error.message
										: "Failed to change directory",
							}),
						);
					}
					break;
				}
			}
		} catch (error) {
			// 记录收到的原始消息以便调试
			logger.error(
				"WebSocket消息处理错误，收到的消息:",
				{ rawMessage },
				error instanceof Error ? error : undefined,
			);
			try {
				ws.send(
					JSON.stringify({
						type: "error",
						error: error instanceof Error ? error.message : "无效消息",
						// 添加更多调试信息
						receivedType: (rawMessage as any)?.type,
					}),
				);
			} catch (sendError) {
				logger.error(
					"发送错误消息失败:",
					{},
					sendError instanceof Error ? sendError : undefined,
				);
			}
		}
	});

	ws.on("close", () => {
		logger.info("WebSocket连接关闭");
		gatewaySession.dispose();
	});

	ws.on("error", (error) => {
		logger.error("WebSocket错误:", {}, error);
		gatewaySession.dispose();
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

			// 关闭WebSocket服务器
			if (wss) {
				logger.info("关闭WebSocket服务器...");
				wss.clients.forEach((client) => {
					if (client.readyState === WebSocket.OPEN) {
						client.close(1001, "服务器正在关闭");
					}
				});
				wss.close();
			}

			// 清理LLM日志管理器
			llmLogManager.dispose();

			// 关闭HTTP服务器
			if (server) {
				server.close(() => {
					logger.info("HTTP服务器已关闭");
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

// 设置优雅关闭
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
║   Pi Gateway Server (新架构)                          ║
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

export { app, GatewaySession, llmLogManager, server, wss };
