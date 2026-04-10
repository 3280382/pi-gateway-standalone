/**
 * Change Directory Message Handler
 * Handles requests to switch working directory
 */

import { existsSync } from "node:fs";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle change_dir message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleChangeDir(
	ctx: WSContext,
	payload: { path: string },
): Promise<void> {
	let { path: newPath } = payload;

	logger.info(`[WebSocket] Received change_dir message: path=${newPath}`);
	logger.info(`[WebSocket] payload full content: ${JSON.stringify(payload)}`);

	try {
		// 检查路径是否存在，如果不存在则使用当前工作目录
		if (!existsSync(newPath)) {
			logger.warn(`[WebSocket] Path does not exist: ${newPath}, using current directory`);
			newPath = process.cwd();
		}

		// Reinitialize session to new directory
		const info = await ctx.session.initialize(newPath);

		ctx.ws.send(
			JSON.stringify({
				type: "dir_changed",
				cwd: info.workingDir,
				sessionId: info.sessionId,
				sessionFile: info.sessionFile,
				pid: process.pid,
				resourceFiles: info.resourceFiles,
			}),
		);

		logger.info(`[WebSocket] change_dir successful: ${newPath}`);
	} catch (error) {
		logger.error(
			`[WebSocket] change_dir error: ${error instanceof Error ? error.message : String(error)}`,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error:
					error instanceof Error ? error.message : "Failed to change directory",
			}),
		);
	}
}
