/**
 * HTTP Route Registration Entry
 * Unified HTTP route registration entry, centrally calling each Feature's route registration functions
 */

import type { Application } from "express";
import { registerAgentsHTTPRoutes } from "../features/agents/http-routes.js";
import { registerChatHTTPRoutes } from "../features/chat/http-routes.js";
import type { LlmLogManager } from "../features/chat/llm/log-manager.js";
import { registerFilesHTTPRoutes } from "../features/files/http-routes.js";
import { registerOrchestrationHTTPRoutes } from "../features/orchestration/http-routes.js";
import { registerWorkspaceHTTPRoutes } from "../features/workspace/http-routes.js";

/**
 * Register all HTTP API routes
 * @param app Express application instance
 * @param llmLogManager LLM log manager
 * @param serverStartTime Server start time
 */
export async function registerRoutes(
  app: Application,
  llmLogManager: LlmLogManager,
  serverStartTime: number
): Promise<void> {
  // Register routes for each Feature in parallel
  await Promise.all([
    registerAgentsHTTPRoutes(app),
    registerChatHTTPRoutes(app, llmLogManager, serverStartTime),
    registerFilesHTTPRoutes(app),
    registerOrchestrationHTTPRoutes(app),
    registerWorkspaceHTTPRoutes(app),
  ]);

  console.log("[API] All routes registered");
}
