/**
 * Tool Request Message Handler
 * Handles requests to manually execute tools
 */

import { createCodingTools } from "@mariozechner/pi-coding-agent";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle tool_request message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleToolRequest(
  ctx: WSContext,
  payload: {
    toolName: string;
    args: Record<string, unknown>;
    toolCallId: string;
  }
): Promise<void> {
  const { toolName, args, toolCallId } = payload;

  logger.info(
    `[WebSocket] Received tool_request message: toolName=${toolName}, toolCallId=${toolCallId}`
  );

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

  try {
    const tools = createCodingTools(ctx.session.workingDir);
    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      ctx.ws.send(
        JSON.stringify({
          type: "tool_end",
          toolCallId,
          result: `Tool "${toolName}" not found`,
          isError: true,
        })
      );
      return;
    }

    // Send start event
    ctx.ws.send(
      JSON.stringify({
        type: "tool_start",
        toolName,
        toolCallId,
        args,
      })
    );

    // Execute tool
    const result = await tool.execute(toolCallId, args as Record<string, string>);

    // Send end event
    ctx.ws.send(
      JSON.stringify({
        type: "tool_end",
        toolCallId,
        result: JSON.stringify(result),
        isError: false,
      })
    );

    logger.info(`[WebSocket] tool_request successful: ${toolName}`);
  } catch (error) {
    logger.error(
      `[WebSocket] tool_request error: ${error instanceof Error ? error.message : String(error)}`
    );
    ctx.ws.send(
      JSON.stringify({
        type: "tool_end",
        toolCallId,
        result: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      })
    );
  }
}
