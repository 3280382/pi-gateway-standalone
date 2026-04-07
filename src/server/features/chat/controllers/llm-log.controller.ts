/**
 * LLM Log Controller
 * Handles LLM log-related API requests
 */

import type { Request, Response } from "express";
import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { LlmLogManager } from "../llm/log-manager";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Get LLM logs
 */
export function createLlmLogController(llmLogManager: LlmLogManager) {
	return {
		/**
		 * Get LLM log content
		 */
		async getLlmLog(_req: Request, res: Response) {
			try {
				const logContent = await llmLogManager.getLogContent();
				const logFilePath = llmLogManager.getLogFilePath();

				logger.info(
					`Retrieved LLM logs, entries: ${logContent.length}, log file: ${logFilePath}`,
				);
				res.json({
					logContent,
					enabled: llmLogManager.isEnabled(),
					logFilePath,
				});
			} catch (error) {
				logger.error(
					`Error retrieving LLM logs: ${error instanceof Error ? error.message : String(error)}`,
				);
				res.status(500).json({ error: String(error) });
			}
		},

		/**
		 * Enable/disable LLM logging
		 */
		async setLlmLogEnabled(req: Request, res: Response) {
			try {
				const { enabled } = req.body;
				if (typeof enabled !== "boolean") {
					res.status(400).json({ error: "enabled parameter must be a boolean" });
					return;
				}

				llmLogManager.setEnabled(enabled);

				logger.info(`${enabled ? "Enabled" : "Disabled"} LLM logging`);
				res.json({ success: true, enabled });
			} catch (error) {
				logger.error(
					`Error setting LLM log enabled state: ${error instanceof Error ? error.message : String(error)}`,
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
