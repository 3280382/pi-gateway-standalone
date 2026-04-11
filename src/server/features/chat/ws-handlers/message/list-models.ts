/**
 * List Models Message Handler
 * Handles requests to list available models
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle list_models message
 * @param ctx WebSocket context
 * @param _payload Message payload (no extra data needed)
 */
export async function handleListModels(ctx: WSContext, _payload: unknown): Promise<void> {
  logger.info("[WebSocket] Received list_models message");

  // Delegate to PiAgentSession.listModels() which reads from /root/.pi/agent/models.json
  await ctx.session.listModels();
  logger.info("[WebSocket] list_models completed");
}
