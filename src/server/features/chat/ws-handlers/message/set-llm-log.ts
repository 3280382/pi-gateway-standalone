/**
 * Set LLM Log Message Handler
 * Handles requests to enable/disable LLM logging
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle set_llm_log message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleSetLlmLog(
	ctx: WSContext,
	payload: { enabled: boolean },
): Promise<void> {
	const { enabled } = payload;

	logger.info(`[WebSocket] Received set_llm_log message: enabled=${enabled}`);

	// Set LLM log status
	ctx.session.llmLogManager.setEnabled(enabled);

	logger.info(`LLM logging ${enabled ? "enabled" : "disabled"}`);

	ctx.ws.send(
		JSON.stringify({
			type: "llm_log_set",
			enabled,
		}),
	);
}
