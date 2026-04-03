/**
 * Abort 消息处理器
 * 处理中止当前 AI 生成的请求
 */

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 abort 消息
 * @param ctx WebSocket 上下文
 * @param _payload 消息负载（abort 不需要额外数据）
 */
export async function handleAbort(
	ctx: WSContext,
	_payload: unknown,
): Promise<void> {
	logger.info("[WebSocket] 收到 abort 消息");

	// 检查会话是否已初始化
	if (!ctx.session.session) {
		logger.warn("[WebSocket] abort 失败：会话未初始化");
		return;
	}

	try {
		await ctx.session.abort();
		logger.info("[WebSocket] abort 成功");
	} catch (error) {
		logger.error(
			"[WebSocket] abort 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
	}
}
