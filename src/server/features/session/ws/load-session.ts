/**
 * Load Session 消息处理器
 * 处理加载指定会话的请求
 */

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 load_session 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleLoadSession(
	ctx: WSContext,
	payload: { sessionPath: string },
): Promise<void> {
	const { sessionPath } = payload;

	logger.info(`[WebSocket] 收到 load_session 消息: sessionPath=${sessionPath}`);

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
		// 使用 GatewaySession 的 loadSession 方法
		await ctx.session.loadSession(sessionPath);
		// loadSession 内部已经发送了响应
		logger.info(`[WebSocket] load_session 成功`);
	} catch (error) {
		logger.error(
			"[WebSocket] load_session 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "session_loaded",
				success: false,
				error: error instanceof Error ? error.message : "加载会话失败",
			}),
		);
	}
}
