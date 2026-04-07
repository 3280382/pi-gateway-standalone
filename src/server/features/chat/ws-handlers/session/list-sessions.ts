/**
 * List Sessions Message Handler
 * Handles requests to list sessions
 */

import { SessionManager } from "@mariozechner/pi-coding-agent";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";
import { getLocalSessionsDir } from "../../agent-session/utils";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle list_sessions message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleListSessions(
	ctx: WSContext,
	payload: { cwd: string },
): Promise<void> {
	const { cwd } = payload;

	logger.info(`[WebSocket] Received list_sessions message: cwd=${cwd}`);

	try {
		const localSessionsDir = getLocalSessionsDir(cwd);
		const sessions = await SessionManager.list(cwd, localSessionsDir);

		ctx.ws.send(
			JSON.stringify({
				type: "sessions_list",
				sessions: sessions.map((s) => ({
					id: s.id,
					path: s.path,
					firstMessage: s.firstMessage,
					messageCount: s.messageCount,
					cwd: s.cwd,
					modified: s.modified.toISOString(),
				})),
			}),
		);

		logger.info(`[WebSocket] list_sessions successful: ${sessions.length} sessions`);
	} catch (error) {
		logger.error(
			"[WebSocket] list_sessions error:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "Failed to list sessions",
			}),
		);
	}
}
