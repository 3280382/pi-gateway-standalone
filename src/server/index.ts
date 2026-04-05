/**
 * Pi Gateway Server - 主入口
 * Feature-Based 架构导出
 */

// 应用模块
export { registerRoutes } from "./app/routes";
// 配置和工具
export { Config } from "./config";
// 核心模块
export {
	PiAgentSession,
	type ServerMessage,
} from "./features/chat/agent-session";
// LLM 相关
export { setupLlmInterceptors } from "./features/chat/llm";
export { LlmLogManager } from "./features/chat/llm/log-manager";
export { AppFactory } from "./lib/app-factory";
export type {
	WSMessagePayload,
	WSMiddleware,
	WSRoute,
	WSContext,
	WSHandler,
	wsRouter,
} from "./features/chat/ws-router";

// WebSocket 处理器注册（导入以触发自动注册）
import "./features/chat/ws-handlers/session/index";
import "./features/chat/ws-handlers/message/index";
