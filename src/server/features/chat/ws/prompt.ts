/**
 * Prompt 消息处理器
 * 处理用户发送的 AI 提示消息
 */

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 prompt 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handlePrompt(
	ctx: WSContext,
	payload: {
		text: string;
		images?: Array<{
			type: "image";
			source: {
				type: "base64";
				mediaType: string;
				data: string;
			};
		}>;
	},
): Promise<void> {
	const { text, images } = payload;

	logger.info(`[WebSocket] 收到 prompt 消息: ${text.substring(0, 50)}...`);

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

	// 调用 session 的 prompt 方法
	// AgentSession.prompt 接受 (text, images?) 参数
	if (ctx.session.isStreaming) {
		// 流式模式需要特殊处理
		await ctx.session.prompt(text, images);
	} else {
		await ctx.session.prompt(text, images);
	}

	logger.info("[WebSocket] prompt 处理完成");
}
