/**
 * New Session Message Handler
 * Handles requests to create a new session
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle new_session message
 * @param ctx WebSocket context
 * @param _payload Message payload (no extra data needed)
 */
export async function handleNewSession(
	ctx: WSContext,
	_payload: unknown,
): Promise<void> {
	logger.info("[WebSocket] Received new_session message");

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
		await ctx.session.newSession();

		ctx.ws.send(
			JSON.stringify({
				type: "session_created",
				sessionId: ctx.session.session.sessionId,
				sessionFile: ctx.session.session.sessionFile,
			}),
		);

		logger.info(
			`[WebSocket] new_session successful: sessionId=${ctx.session.session.sessionId}`,
		);
	} catch (error) {
		logger.error(
			"[WebSocket] new_session error:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "Failed to create new session",
			}),
		);
	}
}
