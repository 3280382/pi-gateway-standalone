/**
 * Set LLM Log 消息处理器
 * 处理启用/禁用 LLM 日志的请求
 */

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 set_llm_log 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleSetLlmLog(
	ctx: WSContext,
	payload: { enabled: boolean },
): Promise<void> {
	const { enabled } = payload;

	logger.info(`[WebSocket] 收到 set_llm_log 消息: enabled=${enabled}`);

	// 设置 LLM 日志状态
	ctx.session.llmLogManager.setEnabled(enabled);

	logger.info(`LLM日志 ${enabled ? "启用" : "禁用"}`);

	ctx.ws.send(
		JSON.stringify({
			type: "llm_log_set",
			enabled,
		}),
	);
}
