/**
 * Change Directory Message Handler
 * Handles requests to switch working directory using server-level session management
 * 
 * Architecture:
 * - When switching directory, end the old session and create new one with new workingDir
 * - ServerSessionManager handles the session lifecycle
 */

import { existsSync } from "node:fs";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import { serverSessionManager } from "../../agent-session/session-manager";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle change_dir message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleChangeDir(ctx: WSContext, payload: { path: string; currentPath?: string }): Promise<void> {
  const { path: newPath, currentPath } = payload;

  logger.info(`[change_dir] ========== START ==========`);
  logger.info(`[change_dir] 1. Received from client: newPath="${newPath}", currentPath="${currentPath || "not provided"}"`);
  logger.info(`[change_dir] 2. Full payload: ${JSON.stringify(payload)}`);

  // 检查当前 session 状态
  logger.info(`[change_dir] 3. Current session state:`);
  logger.info(`[change_dir]    - ctx.session exists: ${!!ctx.session}`);
  logger.info(`[change_dir]    - ctx.session?.session exists: ${!!ctx.session?.session}`);
  logger.info(`[change_dir]    - ctx.session?.workingDir: "${ctx.session?.workingDir}"`);

  try {
    // 检查路径是否存在
    const pathExists = existsSync(newPath);
    logger.info(`[change_dir] 4. Path existence check: existsSync("${newPath}") = ${pathExists}`);

    if (!pathExists) {
      logger.error(`[change_dir] ERROR: Path does not exist: "${newPath}"`);
      ctx.ws.send(
        JSON.stringify({
          type: "error",
          error: `Path does not exist: ${newPath}`,
        })
      );
      logger.info(`[change_dir] ========== END (path not exists) ==========`);
      return;
    }

    // Determine current working directory
    const oldWorkingDir = currentPath || ctx.session?.workingDir || null;
    logger.info(`[change_dir] 5. Old working directory: "${oldWorkingDir}"`);

    // Use server session manager to switch session
    logger.info(`[change_dir] 6. Calling serverSessionManager.switchSession("${oldWorkingDir}", "${newPath}")...`);
    
    const session = await serverSessionManager.switchSession(
      oldWorkingDir || newPath, // Fallback to newPath if old is null
      newPath,
      ctx.ws
    );

    // Update context with new session
    ctx.session = session;

    logger.info(`[change_dir] 7. Session switched:`);
    logger.info(`[change_dir]    - session.sessionId: "${session.session?.sessionId}"`);
    logger.info(`[change_dir]    - session.workingDir: "${session.workingDir}"`);

    const response = {
      type: "dir_changed",
      cwd: session.workingDir,
      sessionId: session.session?.sessionId,
      sessionFile: session.session?.sessionFile,
      pid: process.pid,
      resourceFiles: [], // TODO: Get from resource loader if needed
    };

    logger.info(`[change_dir] 8. Sending response to client: ${JSON.stringify(response)}`);

    ctx.ws.send(JSON.stringify(response));

    logger.info(`[change_dir] ========== END (success) ==========`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[change_dir] ERROR: ${errorMessage}`);
    logger.error(`[change_dir] Stack: ${error instanceof Error ? error.stack : "N/A"}`);

    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: errorMessage,
      })
    );
    logger.info(`[change_dir] ========== END (error) ==========`);
  }
}
