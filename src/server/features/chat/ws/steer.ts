/**
 * Steer 消息处理器
 * 处理流式输出时的引导/干预消息
 */

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 steer 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleSteer(
	ctx: WSContext,
	payload: { text: string },
): Promise<void> {
	const { text } = payload;

	logger.info(`[WebSocket] 收到 steer 消息: ${text.substring(0, 50)}...`);

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

	// 检查是否正在流式传输
	if (!ctx.session.isStreaming) {
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: "当前不在流式传输状态，无法 steer",
			}),
		);
		return;
	}

	try {
		await ctx.session.steer(text);
		logger.info("[WebSocket] steer 处理完成");
	} catch (error) {
		logger.error(
			"[WebSocket] steer 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "steer 失败",
			}),
		);
	}
}
