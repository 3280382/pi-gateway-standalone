/**
 * Thinking Level 消息处理器
 * 处理设置思考级别的请求
 */

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 thinking_level_change 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleThinkingLevelChange(
	ctx: WSContext,
	payload: {
		thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	},
): Promise<void> {
	const { thinkingLevel } = payload;

	logger.info(`[WebSocket] 收到 thinking_level_change 消息: ${thinkingLevel}`);

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
		await ctx.session.setThinkingLevel(thinkingLevel);
		// setThinkingLevel 内部已经发送了响应
		logger.info(`[WebSocket] thinking_level_change 成功`);
	} catch (error) {
		logger.error(
			"[WebSocket] thinking_level_change 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "设置思考级别失败",
			}),
		);
	}
}
