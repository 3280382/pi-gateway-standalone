/**
 * Message Handlers
 * Combined handlers for all message-related WebSocket messages
 */

import { spawn } from "node:child_process";
import { createCodingTools } from "@mariozechner/pi-coding-agent";
import type { WSContext } from "../ws-router";
import {
  createHandler,
  checkSessionInitialized,
  sendError,
  sendSuccess,
  logger,
} from "./handler-utils";

// ============================================================================
// Abort Handler
// ============================================================================

/**
 * Handle abort message
 */
export async function handleAbort(ctx: WSContext, _payload: unknown): Promise<void> {
  await ctx.session.abort();
}

// ============================================================================
// Command Handler
// ============================================================================

/**
 * Handle command message
 */
export async function handleCommand(ctx: WSContext, payload: { text: string }): Promise<void> {
  const { text } = payload;

  // Remove leading /
  const cmd = text.slice(1).trim();

  if (!cmd) {
    sendSuccess(ctx, "command_result", {
      command: text,
      output: "Empty command",
      isError: true,
    });
    return;
  }

  return new Promise((resolve) => {
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

      sendSuccess(ctx, "command_result", {
        command: text,
        output: result || "(no output)",
        isError,
      });
      resolve();
    });

    child.on("error", (error: Error) => {
      sendSuccess(ctx, "command_result", {
        command: text,
        output: error.message,
        isError: true,
      });
      resolve();
    });

    logger.info(`[handleCommand] Executing command: ${cmd}`);
  });
}

// ============================================================================
// List Models Handler
// ============================================================================

/**
 * Handle list_models message
 */
export async function handleListModels(ctx: WSContext, _payload: unknown): Promise<void> {
  try {
    // Import dynamically to avoid circular dependencies
    const { getAllModels } = await import("../session-helpers");
    const models = await getAllModels();

    sendSuccess(ctx, "models_list", { models });
    logger.info(`[handleListModels] Sent ${models.length} models`);
  } catch (error) {
    logger.error(
      `[handleListModels] Error: ${error instanceof Error ? error.message : String(error)}`
    );
    sendError(ctx, "Failed to list models");
  }
}

// ============================================================================
// Prompt Handler
// ============================================================================

/**
 * Handle prompt message
 */
export async function handlePrompt(
  ctx: WSContext,
  payload: {
    text: string;
    images?: Array<{
      type: "image";
      source: {
        type: "base64";
        mediaType: string;
        data: string;
      };
    }>;
  }
): Promise<void> {
  const { text, images } = payload;

  // Call session's prompt method
  // PiAgentSession.prompt accepts (text, images?) parameters
  if (ctx.session.isStreaming) {
    // Streaming mode requires special handling
    await ctx.session.prompt(text, images);
  } else {
    await ctx.session.prompt(text, images);
  }

  logger.info(`[handlePrompt] Processed prompt: ${text.substring(0, 50)}...`);
}

// ============================================================================
// Set LLM Log Handler
// ============================================================================

/**
 * Handle set_llm_log message
 */
export async function handleSetLlmLog(
  ctx: WSContext,
  payload: { enabled: boolean }
): Promise<void> {
  const { enabled } = payload;

  try {
    // Get LLM log manager from session or global
    if (ctx.session.llmLogManager) {
      ctx.session.llmLogManager.setEnabled(enabled);
    }

    sendSuccess(ctx, "llm_log_set", { enabled });
    logger.info(`[handleSetLlmLog] LLM log ${enabled ? "enabled" : "disabled"}`);
  } catch (error) {
    logger.error(
      `[handleSetLlmLog] Error: ${error instanceof Error ? error.message : String(error)}`
    );
    sendError(ctx, "Failed to set LLM log");
  }
}

// ============================================================================
// Set Model Handler
// ============================================================================

/**
 * Handle set_model message
 */
export async function handleSetModel(
  ctx: WSContext,
  payload: {
    provider: string;
    modelId: string;
    thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  }
): Promise<void> {
  const { provider, modelId, thinkingLevel } = payload;

  try {
    await ctx.session.setModel(provider, modelId, thinkingLevel);
    // setModel already sends response internally
    logger.info(`[handleSetModel] Model set to: ${provider}/${modelId}`);
  } catch (error) {
    logger.error("[handleSetModel] Error:", {}, error instanceof Error ? error : undefined);
    sendError(ctx, error instanceof Error ? error.message : "Failed to set model");
  }
}

/**
 * Handle model_change message (simplified, directly calls setModel)
 */
export async function handleModelChange(
  ctx: WSContext,
  payload: {
    provider: string;
    modelId: string;
  }
): Promise<void> {
  // Reuse set_model logic
  await handleSetModel(ctx, payload);
}

// ============================================================================
// Steer Handler
// ============================================================================

/**
 * Handle steer message
 */
export async function handleSteer(ctx: WSContext, payload: { text: string }): Promise<void> {
  const { text } = payload;

  await ctx.session.steer(text);
  sendSuccess(ctx, "steered", { text });
  logger.info(`[handleSteer] Steered: ${text.substring(0, 50)}...`);
}

// ============================================================================
// Thinking Level Handler
// ============================================================================

/**
 * Handle thinking_level_change message
 */
export async function handleThinkingLevelChange(
  ctx: WSContext,
  payload: {
    thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  }
): Promise<void> {
  const { thinkingLevel } = payload;

  await ctx.session.setThinkingLevel(thinkingLevel);
  // setThinkingLevel already sends response internally
  logger.info(`[handleThinkingLevelChange] Thinking level set to: ${thinkingLevel}`);
}

// ============================================================================
// Tool Request Handler
// ============================================================================

/**
 * Handle tool_request message
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

  const tools = createCodingTools(ctx.session.workingDir);
  const tool = tools.find((t) => t.name === toolName);

  if (!tool) {
    sendSuccess(ctx, "tool_end", {
      toolCallId,
      result: `Tool "${toolName}" not found`,
      isError: true,
    });
    return;
  }

  // Send start event
  sendSuccess(ctx, "tool_start", {
    toolName,
    toolCallId,
    args,
  });

  try {
    // Execute tool
    const result = await tool.execute(toolCallId, args as Record<string, string>);

    // Send end event
    sendSuccess(ctx, "tool_end", {
      toolCallId,
      result: JSON.stringify(result),
      isError: false,
    });

    logger.info(`[handleToolRequest] Tool executed: ${toolName}`);
  } catch (error) {
    sendSuccess(ctx, "tool_end", {
      toolCallId,
      result: error instanceof Error ? error.message : "Unknown error",
      isError: true,
    });
  }
}

// ============================================================================
// Wrapped Handlers for Registration
// ============================================================================

export const handleAbortWrapped = createHandler(handleAbort, {
  name: "abort",
  requireSession: true,
});

export const handleCommandWrapped = createHandler(handleCommand, {
  name: "command",
  requireSession: true,
});

export const handleListModelsWrapped = createHandler(handleListModels, {
  name: "list_models",
  requireSession: false,
});

export const handlePromptWrapped = createHandler(handlePrompt, {
  name: "prompt",
  requireSession: true,
});

export const handleSetLlmLogWrapped = createHandler(handleSetLlmLog, {
  name: "set_llm_log",
  requireSession: true,
});

export const handleSetModelWrapped = createHandler(handleSetModel, {
  name: "set_model",
  requireSession: true,
});

export const handleModelChangeWrapped = createHandler(handleModelChange, {
  name: "model_change",
  requireSession: true,
});

export const handleSteerWrapped = createHandler(handleSteer, {
  name: "steer",
  requireSession: true,
});

export const handleThinkingLevelChangeWrapped = createHandler(handleThinkingLevelChange, {
  name: "thinking_level_change",
  requireSession: true,
});

export const handleToolRequestWrapped = createHandler(handleToolRequest, {
  name: "tool_request",
  requireSession: true,
});
