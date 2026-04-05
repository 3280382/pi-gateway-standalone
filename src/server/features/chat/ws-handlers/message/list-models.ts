/**
 * List Models 消息处理器
 * 处理列出可用模型的请求
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 list_models 消息
 * @param ctx WebSocket 上下文
 * @param _payload 消息负载（不需要额外数据）
 */
export async function handleListModels(
	ctx: WSContext,
	_payload: unknown,
): Promise<void> {
	logger.info("[WebSocket] 收到 list_models 消息");

	try {
		const available = await ctx.session.modelRegistry.getAvailable();

		ctx.ws.send(
			JSON.stringify({
				type: "models_list",
				models: available.map((m) => ({
					id: m.id,
					provider: m.provider,
					name: m.name ?? m.id,
					description: "",
				})),
			}),
		);

		logger.info(`[WebSocket] list_models 成功: ${available.length} 个模型`);
	} catch (error) {
		logger.error(
			"[WebSocket] list_models 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "列出模型失败",
			}),
		);
	}
}
