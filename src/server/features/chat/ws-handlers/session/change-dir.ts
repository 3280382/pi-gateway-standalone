/**
 * Change Directory Message Handler
 * Handles requests to switch working directory
 */

import { existsSync } from "node:fs";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle change_dir message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleChangeDir(ctx: WSContext, payload: { path: string }): Promise<void> {
  const { path: newPath } = payload;

  logger.info(`[change_dir] ========== START ==========`);
  logger.info(`[change_dir] 1. Received from client: path="${newPath}"`);
  logger.info(`[change_dir] 2. Full payload: ${JSON.stringify(payload)}`);

  // 检查当前 session 状态
  logger.info(`[change_dir] 3. Current session state:`);
  logger.info(`[change_dir]    - ctx.session exists: ${!!ctx.session}`);
  logger.info(`[change_dir]    - ctx.session.session exists: ${!!ctx.session?.session}`);
  logger.info(`[change_dir]    - ctx.session.workingDir: "${ctx.session?.workingDir}"`);
  logger.info(`[change_dir]    - process.cwd(): "${process.cwd()}"`);

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

    logger.info(`[change_dir] 5. Path exists, calling ctx.session.initialize("${newPath}")...`);

    // Reinitialize session to new directory
    const info = await ctx.session.initialize(newPath);

    logger.info(`[change_dir] 6. initialize() returned:`);
    logger.info(`[change_dir]    - info.workingDir: "${info.workingDir}"`);
    logger.info(`[change_dir]    - info.sessionId: "${info.sessionId}"`);
    logger.info(`[change_dir]    - info.sessionFile: "${info.sessionFile}"`);
    logger.info(
      `[change_dir]    - ctx.session.workingDir after init: "${ctx.session?.workingDir}"`
    );

    const response = {
      type: "dir_changed",
      cwd: info.workingDir,
      sessionId: info.sessionId,
      sessionFile: info.sessionFile,
      pid: process.pid,
      resourceFiles: (info as any).resourceFiles || [],
    };

    logger.info(`[change_dir] 7. Sending response to client: ${JSON.stringify(response)}`);

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
