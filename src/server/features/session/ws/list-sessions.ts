/**
 * List Sessions 消息处理器
 * 处理列出会话的请求
 */

import { SessionManager } from "@mariozechner/pi-coding-agent";
import { getLocalSessionsDir } from "../../../core/session/utils";
import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 list_sessions 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleListSessions(
	ctx: WSContext,
	payload: { cwd: string },
): Promise<void> {
	const { cwd } = payload;

	logger.info(`[WebSocket] 收到 list_sessions 消息: cwd=${cwd}`);

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

		logger.info(`[WebSocket] list_sessions 成功: ${sessions.length} 个会话`);
	} catch (error) {
		logger.error(
			"[WebSocket] list_sessions 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "列出会话失败",
			}),
		);
	}
}
