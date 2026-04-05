/**
 * Pi Gateway Server - 主入口
 * Feature-Based 架构导出
 */

// 应用模块
export { registerRoutes } from "./app/registerRoutes";
// 配置和工具
export { Config } from "./config";
// 核心模块
export { PiAgentSession, type ServerMessage } from "./features/chat/agent-session";
export { AppFactory } from "./lib/app-factory";

// LLM 相关
export { setupLlmInterceptors } from "./llm";
export { LlmLogManager } from "./llm/log-manager";
export type {
	WSMessagePayload,
	WSMiddleware,
	WSRoute,
} from "./shared/websocket/types";
// 共享模块
export {
	type WSContext,
	type WSHandler,
	wsRouter,
} from "./shared/websocket/ws-router";
