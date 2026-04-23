/**
 * Pi Gateway Server - Main Entry
 * Feature-Based architecture exports
 */

// Application modules
export { registerRoutes } from "./app/routes.js";
// Configuration and utilities
export { Config } from "./config/index.js";
// Core modules
export {
  PiAgentSession,
  type ServerMessage,
} from "./features/chat/session/index.js";
// LLM related
export { setupLlmInterceptors } from "./features/chat/llm/index.js";
export { LlmLogManager } from "./features/chat/llm/log-manager.js";
export type {
  WSContext,
  WSHandler,
  WSMessagePayload,
  WSMiddleware,
  WSRoute,
  wsRouter,
} from "./features/chat/ws-router.js";
export { AppFactory } from "./lib/app-factory.js";

// WebSocket handlers are auto-registered when ws-router.ts is imported
