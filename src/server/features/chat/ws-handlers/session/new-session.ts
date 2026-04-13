/**
 * New Session Message Handler
 * Handles requests to create a new session using server-level session management
 * 
 * Architecture:
 * - Creates new session while preserving the current working directory
 * - Uses serverSessionManager to ensure proper lifecycle management
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import { serverSessionManager } from "../../agent-session/session-manager";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle new_session message
 * @param ctx WebSocket context
 * @param payload Message payload (may contain workingDir)
 */
export async function handleNewSession(
  ctx: WSContext, 
  payload: { workingDir?: string }
): Promise<void> {
  logger.info("[WebSocket] Received new_session message");
  logger.info(`[WebSocket] Payload: ${JSON.stringify(payload)}`);

  // Determine working directory: from payload or from current session
  const workingDir = payload.workingDir || ctx.session?.workingDir;
  
  if (!workingDir) {
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: "Working directory not available. Please send init message first or provide workingDir.",
      })
    );
    return;
  }

  try {
    // End the current session for this working directory
    serverSessionManager.endSession(workingDir);
    logger.info(`[WebSocket] Ended current session for: ${workingDir}`);

    // Create new session with the same working directory
    const session = await serverSessionManager.getOrCreateSession(
      workingDir,
      ctx.ws
    );

    // Update context with new session
    ctx.session = session;

    ctx.ws.send(
      JSON.stringify({
        type: "session_created",
        sessionId: session.session!.sessionId,
        sessionFile: session.session!.sessionFile,
        workingDir: session.workingDir,
      })
    );

    logger.info(`[WebSocket] new_session successful: sessionId=${session.session!.sessionId}, workingDir=${workingDir}`);
  } catch (error) {
    logger.error("[WebSocket] new_session error:", {}, error instanceof Error ? error : undefined);
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to create new session",
      })
    );
  }
}
