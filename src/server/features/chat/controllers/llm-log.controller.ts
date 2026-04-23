/**
 * LLM Log Controller
 * Handles LLM log-related API requests
 */

import type { Request, Response } from "express";
import { Logger, LogLevel } from "../../../lib/utils/logger.js";
import type { LlmLogManager } from "../llm/log-manager.js";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Get LLM logs (read-only; write via WebSocket set_llm_log)
 */
export function createLlmLogController(llmLogManager: LlmLogManager) {
  return {
    async getLlmLog(_req: Request, res: Response) {
      try {
        const logContent = await llmLogManager.getLogContent();
        const logFilePath = llmLogManager.getLogFilePath();

        logger.info(`Retrieved LLM logs, entries: ${logContent.length}, log file: ${logFilePath}`);
        res.json({
          logContent,
          enabled: llmLogManager.isEnabled(),
          logFilePath,
        });
      } catch (error) {
        logger.error(
          `Error retrieving LLM logs: ${error instanceof Error ? error.message : String(error)}`
        );
        res.status(500).json({ error: String(error) });
      }
    },
  };
}

export type LlmLogController = ReturnType<typeof createLlmLogController>;
