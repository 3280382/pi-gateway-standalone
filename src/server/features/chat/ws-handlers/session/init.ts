/**
 * Init Message Handler
 * Handles session initialization requests
 */

import { existsSync } from "node:fs";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle init message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleInit(
	ctx: WSContext,
	payload: {
		workingDir: string;
		sessionId?: string;
	},
): Promise<void> {
	const { workingDir, sessionId } = payload;

	logger.info(
		`[WebSocket] Received init message: workingDir=${workingDir}, sessionId=${sessionId || "not specified"}`,
	);

	try {
		// 检查路径是否存在，如果不存在则直接报错
		if (!existsSync(workingDir)) {
			logger.error(`[WebSocket] Path does not exist: ${workingDir}`);
			ctx.ws.send(
				JSON.stringify({
					type: "error",
					error: `Path does not exist: ${workingDir}`,
				}),
			);
			return;
		}

		const info = await ctx.session.initialize(workingDir, sessionId);

		ctx.ws.send(
			JSON.stringify({
				type: "initialized",
				...info,
				pid: process.pid,
			}),
		);

		logger.info(`[WebSocket] init successful: sessionId=${info.sessionId}`);
	} catch (error) {
		logger.error(
			"[WebSocket] init error:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error:
					error instanceof Error
						? error.message
						: "Failed to initialize session",
			}),
		);
	}
}
