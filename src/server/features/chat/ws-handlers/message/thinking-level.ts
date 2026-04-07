/**
 * Thinking Level Message Handler
 * Handles requests to set thinking level
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle thinking_level_change message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleThinkingLevelChange(
	ctx: WSContext,
	payload: {
		thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	},
): Promise<void> {
	const { thinkingLevel } = payload;

	logger.info(`[WebSocket] Received thinking_level_change message: ${thinkingLevel}`);

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
		await ctx.session.setThinkingLevel(thinkingLevel);
		// setThinkingLevel already sends response internally
		logger.info(`[WebSocket] thinking_level_change successful`);
	} catch (error) {
		logger.error(
			"[WebSocket] thinking_level_change error:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "Failed to set thinking level",
			}),
		);
	}
}
