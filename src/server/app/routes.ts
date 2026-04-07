/**
 * HTTP Route Registration Entry
 * Unified HTTP route registration entry, centrally calling each Feature's route registration functions
 */

import type { Application } from "express";
import type { LlmLogManager } from "../features/chat/llm/log-manager";
import { registerChatHTTPRoutes } from "../features/chat/http-routes";
import {
	registerFilesHTTPRoutes,
	registerWorkspaceRoutes,
} from "../features/files/http-routes";

/**
 * Register all HTTP API routes
 * @param app Express application instance
 * @param llmLogManager LLM log manager
 * @param serverStartTime Server start time
 */
export async function registerRoutes(
	app: Application,
	llmLogManager: LlmLogManager,
	serverStartTime: number,
): Promise<void> {
	// Register routes for each Feature in parallel
	await Promise.all([
		registerChatHTTPRoutes(app, llmLogManager, serverStartTime),
		registerFilesHTTPRoutes(app),
	]);

	// Register Workspace routes synchronously
	registerWorkspaceRoutes(app);

	console.log("[API] All routes registered");
}
