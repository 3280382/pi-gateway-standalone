/**
 * Steer Message Handler
 * Handles steering/intervention messages during streaming output
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle steer message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleSteer(ctx: WSContext, payload: { text: string }): Promise<void> {
  const { text } = payload;

  logger.info(`[WebSocket] Received steer message: ${text.substring(0, 50)}...`);

  // Check if session is initialized
  if (!ctx.session.session) {
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: "Session not initialized, please send init message first",
      })
    );
    return;
  }

  // Check if currently streaming
  if (!ctx.session.isStreaming) {
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: "Not currently streaming, cannot steer",
      })
    );
    return;
  }

  try {
    await ctx.session.steer(text);
    logger.info("[WebSocket] steer processing completed");
  } catch (error) {
    logger.error("[WebSocket] steer error:", {}, error instanceof Error ? error : undefined);
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : "steer failed",
      })
    );
  }
}
