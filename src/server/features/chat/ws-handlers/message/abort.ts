/**
 * Abort Message Handler
 * Handles requests to abort current AI generation
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle abort message
 * @param ctx WebSocket context
 * @param _payload Message payload (abort doesn't need extra data)
 */
export async function handleAbort(ctx: WSContext, _payload: unknown): Promise<void> {
  logger.info("[WebSocket] Received abort message");

  // Check if session is initialized
  if (!ctx.session.session) {
    logger.warn("[WebSocket] abort failed: session not initialized");
    return;
  }

  try {
    await ctx.session.abort();
    logger.info("[WebSocket] abort successful");
  } catch (error) {
    logger.error("[WebSocket] abort error:", {}, error instanceof Error ? error : undefined);
  }
}
