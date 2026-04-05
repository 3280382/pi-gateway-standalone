/**
 * Command 消息处理器
 * 处理执行系统命令的请求
 */

import { spawn } from "node:child_process";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 处理 command 消息
 * @param ctx WebSocket 上下文
 * @param payload 消息负载
 */
export async function handleCommand(
	ctx: WSContext,
	payload: { text: string },
): Promise<void> {
	const { text } = payload;

	// 移除前导/
	const cmd = text.slice(1).trim();

	logger.info(`[WebSocket] 收到 command 消息: ${cmd}`);

	if (!cmd) {
		ctx.ws.send(
			JSON.stringify({
				type: "command_result",
				command: text,
				output: "空命令",
				isError: true,
			}),
		);
		return;
	}

	try {
		const [executable, ...args] = cmd.split(/\s+/);

		const child = spawn(executable, args, {
			cwd: ctx.session.workingDir,
			env: process.env,
			shell: false,
		});

		let output = "";
		let errorOutput = "";

		child.stdout.on("data", (data: Buffer) => {
			output += data.toString();
		});

		child.stderr.on("data", (data: Buffer) => {
			errorOutput += data.toString();
		});

		child.on("close", (code: number | null) => {
			const isError = code !== 0;
			const result = errorOutput
				? `${output}\n${errorOutput}`.trim()
				: output.trim();

			ctx.ws.send(
				JSON.stringify({
					type: "command_result",
					command: text,
					output: result || "(无输出)",
					isError,
				}),
			);
		});

		child.on("error", (error: Error) => {
			ctx.ws.send(
				JSON.stringify({
					type: "command_result",
					command: text,
					output: error.message,
					isError: true,
				}),
			);
		});

		logger.info(`[WebSocket] command 执行中: ${cmd}`);
	} catch (error) {
		logger.error(
			`[WebSocket] command 错误: ${error instanceof Error ? error.message : String(error)}`,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "command_result",
				command: text,
				output: error instanceof Error ? error.message : "未知错误",
				isError: true,
			}),
		);
	}
}
