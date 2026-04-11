/**
 * Command Message Handler
 * Handles requests to execute system commands
 */

import { spawn } from "node:child_process";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle command message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleCommand(ctx: WSContext, payload: { text: string }): Promise<void> {
  const { text } = payload;

  // Remove leading /
  const cmd = text.slice(1).trim();

  logger.info(`[WebSocket] Received command message: ${cmd}`);

  if (!cmd) {
    ctx.ws.send(
      JSON.stringify({
        type: "command_result",
        command: text,
        output: "Empty command",
        isError: true,
      })
    );
    return;
  }

  try {
    const [executable, ...args] = cmd.split(/\s+/);

    const child = spawn(executable, args, {
      cwd: ctx.session.workingDir,
      env: process.env,
      shell: false,
    });

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    child.on("close", (code: number | null) => {
      const isError = code !== 0;
      const result = errorOutput ? `${output}\n${errorOutput}`.trim() : output.trim();

      ctx.ws.send(
        JSON.stringify({
          type: "command_result",
          command: text,
          output: result || "(no output)",
          isError,
        })
      );
    });

    child.on("error", (error: Error) => {
      ctx.ws.send(
        JSON.stringify({
          type: "command_result",
          command: text,
          output: error.message,
          isError: true,
        })
      );
    });

    logger.info(`[WebSocket] command executing: ${cmd}`);
  } catch (error) {
    logger.error(
      `[WebSocket] command error: ${error instanceof Error ? error.message : String(error)}`
    );
    ctx.ws.send(
      JSON.stringify({
        type: "command_result",
        command: text,
        output: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      })
    );
  }
}
