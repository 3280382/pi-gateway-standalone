/**
 * Chat Feature WebSocket 处理器注册
 * 集中注册所有聊天相关的 WebSocket 消息处理器
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
 * 注册 Chat Feature 的所有 WebSocket 处理器
 */
export function registerChatWSHandlers(): void {
	// 聊天核心功能
	wsRouter.register("prompt", handlePrompt);
	wsRouter.register("abort", handleAbort);
	wsRouter.register("steer", handleSteer);

	// 模型相关
	wsRouter.register("set_model", handleSetModel);
	wsRouter.register("model_change", handleModelChange);
	wsRouter.register("list_models", handleListModels);
	wsRouter.register("thinking_level_change", handleThinkingLevelChange);

	// 工具相关
	wsRouter.register("tool_request", handleToolRequest);

	// 命令执行
	wsRouter.register("command", handleCommand);

	// LLM 日志
	wsRouter.register("set_llm_log", handleSetLlmLog);
}

// 自动注册（在模块加载时）
registerChatWSHandlers();

// 导出处理器（供单独使用）
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
