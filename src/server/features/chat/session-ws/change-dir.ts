/**
 * Change Directory 消息处理器
 * 处理切换工作目录的请求
 */

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 change_dir 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleChangeDir(
	ctx: WSContext,
	payload: { path: string },
): Promise<void> {
	const { path: newPath } = payload;

	logger.info(`[WebSocket] 收到 change_dir 消息: path=${newPath}`);

	try {
		// 重新初始化会话到新目录
		const info = await ctx.session.initialize(newPath);

		ctx.ws.send(
			JSON.stringify({
				type: "dir_changed",
				cwd: info.workingDir,
				sessionId: info.sessionId,
				sessionFile: info.sessionFile,
				pid: process.pid,
			}),
		);

		logger.info(`[WebSocket] change_dir 成功: ${newPath}`);
	} catch (error) {
		logger.error(
			`[WebSocket] change_dir 错误: ${error instanceof Error ? error.message : String(error)}`,
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
