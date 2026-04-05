/**
 * Tool Request 消息处理器
 * 处理手动执行工具的请求
 */

import { createCodingTools } from "@mariozechner/pi-coding-agent";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 tool_request 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleToolRequest(
	ctx: WSContext,
	payload: {
		toolName: string;
		args: Record<string, unknown>;
		toolCallId: string;
	},
): Promise<void> {
	const { toolName, args, toolCallId } = payload;

	logger.info(
		`[WebSocket] 收到 tool_request 消息: toolName=${toolName}, toolCallId=${toolCallId}`,
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
		const tools = createCodingTools(ctx.session.workingDir);
		const tool = tools.find((t) => t.name === toolName);

		if (!tool) {
			ctx.ws.send(
				JSON.stringify({
					type: "tool_end",
					toolCallId,
					result: `工具 "${toolName}" 未找到`,
					isError: true,
				}),
			);
			return;
		}

		// 发送开始事件
		ctx.ws.send(
			JSON.stringify({
				type: "tool_start",
				toolName,
				toolCallId,
				args,
			}),
		);

		// 执行工具
		const result = await tool.execute(
			toolCallId,
			args as Record<string, string>,
		);

		// 发送结束事件
		ctx.ws.send(
			JSON.stringify({
				type: "tool_end",
				toolCallId,
				result: JSON.stringify(result),
				isError: false,
			}),
		);

		logger.info(`[WebSocket] tool_request 成功: ${toolName}`);
	} catch (error) {
		logger.error(
			`[WebSocket] tool_request 错误: ${error instanceof Error ? error.message : String(error)}`,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "tool_end",
				toolCallId,
				result: error instanceof Error ? error.message : "未知错误",
				isError: true,
			}),
		);
	}
}
