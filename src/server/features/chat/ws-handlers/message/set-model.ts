/**
 * Set Model 消息处理器
 * 处理设置 AI 模型的请求
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 set_model 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleSetModel(
	ctx: WSContext,
	payload: {
		provider: string;
		modelId: string;
		thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	},
): Promise<void> {
	const { provider, modelId, thinkingLevel } = payload;

	console.log(`[WebSocket] 收到 set_model 消息:`, {
		provider,
		modelId,
		thinkingLevel,
	});
	logger.info(
		`[WebSocket] 收到 set_model 消息: provider=${provider}, modelId=${modelId}`,
	);

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
		await ctx.session.setModel(provider, modelId, thinkingLevel);
		// setModel 内部已经发送了响应
		logger.info(`[WebSocket] set_model 成功`);
	} catch (error) {
		logger.error(
			"[WebSocket] set_model 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "设置模型失败",
			}),
		);
	}
}

/**
 * 处理 model_change 消息（简化版，直接调用 setModel）
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleModelChange(
	ctx: WSContext,
	payload: {
		provider: string;
		modelId: string;
	},
): Promise<void> {
	// 复用 set_model 逻辑
	await handleSetModel(ctx, payload);
}
