/**
 * Chat Feature WebSocket Handler Registration
 * Centralized registration of all chat-related WebSocket message handlers
 */

import { wsRouter } from "../../ws-router";
import { handleAbort } from "./abort";
import { handleCommand } from "./command";
import { handleListModels } from "./list-models";
import { handlePrompt } from "./prompt";
import { handleSetLlmLog } from "./set-llm-log";
import { handleModelChange, handleSetModel } from "./set-model";
import { handleSteer } from "./steer";
import { handleThinkingLevelChange } from "./thinking-level";
import { handleToolRequest } from "./tool-request";

/**
 * Register all Chat Feature WebSocket handlers
 */
export function registerChatWSHandlers(): void {
	// Chat core functionality
	wsRouter.register("prompt", handlePrompt);
	wsRouter.register("abort", handleAbort);
	wsRouter.register("steer", handleSteer);

	// Model related
	wsRouter.register("set_model", handleSetModel);
	wsRouter.register("model_change", handleModelChange);
	wsRouter.register("list_models", handleListModels);
	wsRouter.register("thinking_level_change", handleThinkingLevelChange);

	// Tool related
	wsRouter.register("tool_request", handleToolRequest);

	// Command execution
	wsRouter.register("command", handleCommand);

	// LLM logs
	wsRouter.register("set_llm_log", handleSetLlmLog);
}

// Auto-register (when module loads)
registerChatWSHandlers();

// Export handlers (for standalone use)
export {
	handleAbort,
	handleCommand,
	handleListModels,
	handleModelChange,
	handlePrompt,
	handleSetLlmLog,
	handleSetModel,
	handleSteer,
	handleThinkingLevelChange,
	handleToolRequest,
};
