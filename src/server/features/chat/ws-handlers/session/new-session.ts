/**
 * New Session 消息处理器
 * 处理创建新会话的请求
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 new_session 消息
 * @param ctx WebSocket 上下文
 * @param _payload 消息负载（不需要额外数据）
 */
export async function handleNewSession(
	ctx: WSContext,
	_payload: unknown,
): Promise<void> {
	logger.info("[WebSocket] 收到 new_session 消息");

	// 检查会话是否已初始化
	if (!ctx.session.session) {
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: "会话未初始化，请先发送 init 消息",
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
			`[WebSocket] new_session 成功: sessionId=${ctx.session.session.sessionId}`,
		);
	} catch (error) {
		logger.error(
			"[WebSocket] new_session 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "创建新会话失败",
			}),
		);
	}
}
