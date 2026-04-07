/**
 * Load Session Message Handler
 * Handles requests to load a specified session
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle load_session message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleLoadSession(
	ctx: WSContext,
	payload: { sessionPath: string },
): Promise<void> {
	const { sessionPath } = payload;

	logger.info(`[WebSocket] Received load_session message: sessionPath=${sessionPath}`);

	// Check if session is initialized
	if (!ctx.session.session) {
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: "Session not initialized, please send init message first",
			}),
		);
		return;
	}

	try {
		// Use PiAgentSession's loadSession method
		await ctx.session.loadSession(sessionPath);
		// loadSession already sends response internally
		logger.info(`[WebSocket] load_session successful`);
	} catch (error) {
		logger.error(
			"[WebSocket] load_session error:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "session_loaded",
				success: false,
				error: error instanceof Error ? error.message : "Failed to load session",
			}),
		);
	}
}
