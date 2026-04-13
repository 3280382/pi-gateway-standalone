/**
 * Init Message Handler
 * Handles session initialization requests using server-level session management
 * 
 * Architecture:
 * - PiAgentSession lifecycle is server-level, not WebSocket connection-level
 * - Multiple WebSocket connections can share the same PiAgentSession
 * - Init message compares workingDir with existing server-level session
 *   - If same: reuse existing session, resubscribe to events
 *   - If different: end old session, create new one with provided workingDir
 */

import { existsSync } from "node:fs";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import { serverSessionManager } from "../../agent-session/session-manager";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle init message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleInit(
  ctx: WSContext,
  payload: {
    workingDir?: string;
    sessionId?: string;
  }
): Promise<void> {
  // 如果没有提供 workingDir，使用服务器当前工作目录
  const workingDir = payload.workingDir || process.cwd();
  const { sessionId } = payload;

  logger.info(
    `[WebSocket] Received init message: workingDir=${workingDir}, sessionId=${sessionId || "not specified"}`
  );

  try {
    // 检查路径是否存在，如果不存在则直接报错
    if (!existsSync(workingDir)) {
      logger.error(`[WebSocket] Path does not exist: ${workingDir}`);
      ctx.ws.send(
        JSON.stringify({
          type: "error",
          error: `Path does not exist: ${workingDir}`,
        })
      );
      return;
    }

    // Use server-level session manager to get or create session
    // This ensures session lifecycle is independent of WebSocket connection
    const session = await serverSessionManager.getOrCreateSession(
      workingDir,
      ctx.ws,
      sessionId
    );

    // Update context with the server-level session
    ctx.session = session;

    // Get session info to return to client
    const info = {
      sessionId: session.session!.sessionId,
      sessionFile: session.session!.sessionFile,
      workingDir: session.workingDir,
      model: session.session!.model?.id || null,
      modelProvider: session.session!.model?.provider || null,
      thinkingLevel: session.session!.thinkingLevel,
      systemPrompt: "", // TODO: Get from resource loader if needed
      agentsFiles: [] as any[],
      skills: [] as any[],
    };

    ctx.ws.send(
      JSON.stringify({
        type: "initialized",
        ...info,
        pid: process.pid,
      })
    );

    logger.info(`[WebSocket] init successful: sessionId=${info.sessionId}, workingDir=${workingDir}`);
  } catch (error) {
    logger.error("[WebSocket] init error:", {}, error instanceof Error ? error : undefined);
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to initialize session",
      })
    );
  }
}
