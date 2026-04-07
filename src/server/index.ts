/**
 * Pi Gateway Server - Main Entry
 * Feature-Based architecture exports
 */

// Application modules
export { registerRoutes } from "./app/routes";
// Configuration and utilities
export { Config } from "./config";
// Core modules
export {
	PiAgentSession,
	type ServerMessage,
} from "./features/chat/agent-session";
// LLM related
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

// WebSocket handler registration (import to trigger auto-registration)
import "./features/chat/ws-handlers/session/index";
import "./features/chat/ws-handlers/message/index";
