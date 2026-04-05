/**
 * LLM日志控制器
 * 处理LLM日志相关的API请求
 */

import type { Request, Response } from "express";
import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { LlmLogManager } from "../llm/log-manager";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 获取LLM日志
 */
export function createLlmLogController(llmLogManager: LlmLogManager) {
	return {
		/**
		 * 获取LLM日志内容
		 */
		async getLlmLog(_req: Request, res: Response) {
			try {
				const logContent = await llmLogManager.getLogContent();
				const logFilePath = llmLogManager.getLogFilePath();

				logger.info(
					`获取LLM日志，条目数: ${logContent.length}, 日志文件: ${logFilePath}`,
				);
				res.json({
					logContent,
					enabled: llmLogManager.isEnabled(),
					logFilePath,
				});
			} catch (error) {
				logger.error(
					`获取LLM日志错误: ${error instanceof Error ? error.message : String(error)}`,
				);
				res.status(500).json({ error: String(error) });
			}
		},

		/**
		 * 启用/禁用LLM日志
		 */
		async setLlmLogEnabled(req: Request, res: Response) {
			try {
				const { enabled } = req.body;
				if (typeof enabled !== "boolean") {
					res.status(400).json({ error: "enabled参数必须是布尔值" });
					return;
				}

				llmLogManager.setEnabled(enabled);

				logger.info(`${enabled ? "启用" : "禁用"}LLM日志`);
				res.json({ success: true, enabled });
			} catch (error) {
				logger.error(
					`设置LLM日志启用状态错误: ${error instanceof Error ? error.message : String(error)}`,
					{
						enabled: req.body.enabled,
					},
				);
				res.status(500).json({ error: String(error) });
			}
		},
	};
}

export type LlmLogController = ReturnType<typeof createLlmLogController>;
