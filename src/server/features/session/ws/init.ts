/**
 * Init 消息处理器
 * 处理会话初始化请求
 */

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { WSContext } from "../../../shared/websocket/ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 init 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleInit(
	ctx: WSContext,
	payload: {
		workingDir: string;
		sessionId?: string;
	},
): Promise<void> {
	const { workingDir, sessionId } = payload;

	logger.info(
		`[WebSocket] 收到 init 消息: workingDir=${workingDir}, sessionId=${sessionId || "未指定"}`,
	);

	try {
		const info = await ctx.session.initialize(workingDir, sessionId);

		ctx.ws.send(
			JSON.stringify({
				type: "initialized",
				...info,
				pid: process.pid,
			}),
		);

		logger.info(`[WebSocket] init 成功: sessionId=${info.sessionId}`);
	} catch (error) {
		logger.error(
			"[WebSocket] init 错误:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "初始化会话失败",
			}),
		);
	}
}
