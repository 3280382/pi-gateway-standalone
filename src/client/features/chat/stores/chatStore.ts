/**
 * Chat Store - Zustand State Management with Performance Optimizations
 * 使用批量更新和RAF调度优化流式消息性能
 *
 * 【架构设计说明】
 * 本 Store 是 Chat Feature 的核心状态管理中心。
 *
 * 【数据流】
 * 1. 用户发送消息: UI → useChat/useChatController → websocketService.send()
 * 2. 接收AI响应: WebSocket → setupWebSocketListeners() → chatStore (本文件)
 * 3. 组件更新: chatStore → React re-render → UI
 *
 * 【特殊设计】
 * - WebSocket 事件处理在 setupWebSocketListeners() (chatApi.ts)
 * - 该处理器直接调用本 Store 的方法更新状态，这是 WebSocket 服务的特例
 * - 详情见 chatApi.ts 中的架构注释
 *
 * 【性能优化】
 * - 使用 RAF (requestAnimationFrame) 批量处理流式消息
 * - 使用 Zustand selectors 避免不必要的重渲染
 * - 工具调用使用 Map 存储，支持快速查找
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
	ChatSearchFilters,
	ChatState,
	Message,
	SearchResult,
	ToolExecution,
} from "@/features/chat/types/chat";

// ============================================================================
// Types
// ============================================================================

interface ContentPart {
	type: "thinking" | "text" | "tool" | "tool_use" | "turn_marker";
	thinking?: string;
	text?: string;
	toolCallId?: string;
	toolName?: string;
	args?: Record<string, unknown>;
	partialArgs?: string;
	output?: string;
	error?: string;
	turnNumber?: number;
}

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = () => ({
	messages: [] as Message[],
	currentStreamingMessage: null as Message | null,
	inputText: "",
	isInputFocused: false,
	isStreaming: false,
	streamingContent: "",
	streamingThinking: "",
	streamingThinkings: [] as Array<{ id: string; content: string }>, // 多轮思考支持
	streamingToolCalls: new Map<
		string,
		{ id: string; name: string; args: string }
	>(),
	activeTools: new Map<string, ToolExecution>(),
	showThinking: true,
	showTools: true,
	scrollToBottom: false,
	searchQuery: "",
	searchFilters: {
		user: true,
		assistant: true,
		thinking: true,
		tools: true,
	},
	searchResults: [] as SearchResult[],
	isSearching: false,
	currentSearchIndex: -1,
	currentModel: null as string | null,
	sessionId: null as string | null,
});

type State = ReturnType<typeof createInitialState>;

// ============================================================================
// Message ID Generator
// ============================================================================

function generateMessageId(): string {
	return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Content Builder Helpers
// ============================================================================

interface ContentPartWithOrder extends ContentPart {
	_order: number;
}

// 内容顺序常量 - 确保相对顺序：thinking < tools < text
const ORDER = {
	THINKING_BASE: 0,
	TOOL_BASE: 100000,
	TEXT_BASE: 200000,
	THINKING_STEP: 1000,
} as const;

/**
 * 构建思考内容部分 - 只使用当前流式思考，不使用已固化的思考数组
 * 已固化的思考已经在 existingContent 中
 */
function buildThinkingContent(singleThinking: string): ContentPartWithOrder[] {
	if (!singleThinking) return [];

	return [{
		type: "thinking",
		thinking: singleThinking,
		_order: ORDER.THINKING_BASE,
	}];
}

/**
 * 构建文本内容部分
 */
function buildTextContent(textContent: string): ContentPartWithOrder[] {
	if (!textContent) return [];

	return [
		{
			type: "text",
			text: textContent,
			_order: ORDER.TEXT_BASE,
		},
	];
}

/**
 * 收集工具条目（已完成和流式中）
 */
function collectToolEntries(
	state: State,
): Array<{ tool: any; isCompleted: boolean }> {
	const entries: Array<{ tool: any; isCompleted: boolean }> = [];

	// 添加已完成的工具
	state.activeTools.forEach((tool) => {
		entries.push({ tool, isCompleted: true });
	});

	// 添加流式中的工具（只添加没有完成版本的）
	state.streamingToolCalls.forEach((tool) => {
		if (!state.activeTools.get(tool.id)) {
			entries.push({ tool, isCompleted: false });
		}
	});

	// 按开始时间排序
	entries.sort((a, b) => {
		const timeA = a.tool.startTime?.getTime() || 0;
		const timeB = b.tool.startTime?.getTime() || 0;
		return timeA - timeB;
	});

	return entries;
}

/**
 * 构建工具内容部分
 */
function buildToolContent(
	toolEntries: Array<{ tool: any; isCompleted: boolean }>,
): ContentPartWithOrder[] {
	return toolEntries.map((entry, index) => {
		const { tool, isCompleted } = entry;
		const baseOrder = ORDER.TOOL_BASE + index;

		if (isCompleted) {
			return {
				type: "tool" as const,
				toolCallId: tool.id,
				toolName: tool.name,
				args: tool.args,
				output: tool.output,
				error: tool.error,
				_order: baseOrder,
			};
		}

		return {
			type: "tool_use" as const,
			toolCallId: tool.id,
			toolName: tool.name,
			partialArgs: tool.args,
			_order: baseOrder,
		};
	});
}

/**
 * 构建内容数组，保持时序顺序
 * 顺序：thinking -> tools -> text
 * 注意：只构建当前流式内容，已固化的内容在 existingContent 中
 */
function buildContentArray(state: State): ContentPart[] {
	const content: ContentPartWithOrder[] = [
		...buildThinkingContent(state.streamingThinking),
		...buildToolContent(collectToolEntries(state)),
		...buildTextContent(state.streamingContent),
	];

	// 按顺序排序并返回（移除 _order 字段）
	return content
		.sort((a, b) => a._order - b._order)
		.map(({ _order, ...rest }) => rest as ContentPart);
}

// ============================================================================
// RAF Batch Update System
// ============================================================================

/** 待处理的 RAF 更新 */
interface PendingUpdates {
	content?: string;
	thinking?: string;
	toolCalls?: Map<string, { id: string; name: string; args: string }>;
}

let rafId: number | null = null;
let pendingContentUpdates: PendingUpdates = {};

/**
 * 获取需要保留的内容（已固化的内容块）
 * 保留所有非流式内容块（已固化的 thinking, text, tool_use）
 */
function getPreservedContent(existingContent: any[]): any[] {
	if (!existingContent || existingContent.length === 0) return [];
	
	// 保留所有已固化的内容（thinking, text, tool_use, tool, turn_marker）
	// 这些是已经通过 endContentBlock 固化的内容
	return existingContent.filter((c: any) => 
		['thinking', 'text', 'tool_use', 'tool', 'turn_marker'].includes(c.type)
	);
}

/**
 * 应用 RAF 批处理更新
 * 只更新流式状态，不操作 currentStreamingMessage.content
 */
function applyRafUpdate(
	state: State,
	pending: PendingUpdates,
): Partial<State> | null {
	if (!state.currentStreamingMessage) return null;

	const newContent = state.streamingContent + (pending.content || "");
	const newThinking = state.streamingThinking + (pending.thinking || "");
	const newToolCalls = pending.toolCalls || state.streamingToolCalls;

	return {
		streamingContent: newContent,
		streamingThinking: newThinking,
		streamingToolCalls: newToolCalls,
	};
}

/**
 * 构建最终消息内容
 * 使用已固化的 existingContent + 剩余流式状态
 */
function buildFinalMessage(
	state: State,
	finalContentToApply: string,
	finalThinkingToApply: string,
): { finalMessage: any | null; finalContent: any[] } {
	const existingContent = state.currentStreamingMessage?.content || [];

	// 构建剩余的流式内容（endContentBlock 后可能还有未清空的）
	const remainingContent: ContentPart[] = [];
	
	if (state.streamingThinking || finalThinkingToApply) {
		remainingContent.push({
			type: "thinking",
			thinking: state.streamingThinking + finalThinkingToApply,
		});
	}
	
	state.streamingToolCalls.forEach((tool) => {
		remainingContent.push({
			type: "tool_use",
			toolCallId: tool.id,
			toolName: tool.name,
			partialArgs: tool.args,
		});
	});
	
	if (state.streamingContent || finalContentToApply) {
		remainingContent.push({
			type: "text",
			text: state.streamingContent + finalContentToApply,
		});
	}

	// 合并已固化内容和剩余流式内容
	const finalContent = [...existingContent, ...remainingContent];

	const finalMessage = state.currentStreamingMessage
		? {
				...state.currentStreamingMessage,
				content: finalContent,
				isStreaming: false,
				isThinkingCollapsed: true,
				isToolsCollapsed: true,
			}
		: null;

	return { finalMessage, finalContent };
}

/**
 * 合并工具参数（保留流式参数）
 */
function mergeToolArgs(
	tool: ToolExecution,
	streamingArgs?: string,
): Record<string, unknown> {
	return streamingArgs
		? { ...tool.args, _streamingArgs: streamingArgs }
		: tool.args;
}

/**
 * 应用工具激活
 */
function applyToolActivation(
	state: State,
	tool: ToolExecution,
): Partial<State> {
	const streamingTool = state.streamingToolCalls.get(tool.id);
	const mergedTool = {
		...tool,
		args: mergeToolArgs(tool, streamingTool?.args),
	};

	const newTools = new Map(state.activeTools).set(tool.id, mergedTool);
	const newStreamingToolCalls = new Map(state.streamingToolCalls);
	newStreamingToolCalls.delete(tool.id);

	if (!state.currentStreamingMessage) {
		return { activeTools: newTools, streamingToolCalls: newStreamingToolCalls };
	}

	const contentArray = buildContentArray({
		...state,
		activeTools: newTools,
		streamingToolCalls: newStreamingToolCalls,
	});

	return {
		activeTools: newTools,
		streamingToolCalls: newStreamingToolCalls,
		currentStreamingMessage: {
			...state.currentStreamingMessage,
			content: contentArray,
		},
	};
}

/**
 * 应用工具完成
 */
function applyToolCompletion(
	state: State,
	toolId: string,
	output: string,
	error?: string,
): Partial<State> {
	const newTools = new Map(state.activeTools);
	const tool = newTools.get(toolId);

	if (tool) {
		newTools.set(toolId, {
			...tool,
			output,
			error,
			status: error ? "error" : "success",
			endTime: new Date(),
		});
	}

	if (!state.currentStreamingMessage) {
		return { activeTools: newTools };
	}

	const contentArray = buildContentArray({
		...state,
		activeTools: newTools,
		streamingToolCalls: state.streamingToolCalls,
	});

	return {
		activeTools: newTools,
		currentStreamingMessage: {
			...state.currentStreamingMessage,
			content: contentArray,
		},
	};
}

/**
 * 统一处理流式结束（abort 和 finish）
 */
function finalizeStreaming(
	set: (
		fn: (state: State) => Partial<State>,
		replace?: boolean,
		action?: string,
	) => void,
	actionName: "abortStreaming" | "finishStreaming",
) {
	const finalContentToApply = pendingContentUpdates.content || "";
	const finalThinkingToApply = pendingContentUpdates.thinking || "";
	pendingContentUpdates = {};

	set(
		(state) => {
			const { finalMessage } = buildFinalMessage(
				state,
				finalContentToApply,
				finalThinkingToApply,
			);

			return {
				isStreaming: false,
				messages: finalMessage
					? [...state.messages, finalMessage]
					: state.messages,
				currentStreamingMessage: null,
				streamingContent: "",
				streamingThinking: "",
				streamingThinkings: [],
				streamingToolCalls: new Map(),
				activeTools: new Map(),
			};
		},
		false,
		actionName,
	);
}

/**
 * 应用批处理更新
 */
function applyBatchUpdates(
	state: State,
	updates: {
		content?: string;
		thinking?: string;
		toolCall?: { id: string; name: string; delta: string };
	},
): Partial<State> {
	let newContent = state.streamingContent;
	let newThinking = state.streamingThinking;
	let newToolCalls = state.streamingToolCalls;

	if (updates.content) {
		newContent += updates.content;
	}

	if (updates.thinking) {
		newThinking += updates.thinking;
	}

	if (updates.toolCall) {
		const { id, name, delta } = updates.toolCall;
		newToolCalls = new Map(newToolCalls);
		const existing = newToolCalls.get(id);
		if (existing) {
			newToolCalls.set(id, { ...existing, args: existing.args + delta });
		} else {
			newToolCalls.set(id, { id, name, args: delta });
		}
	}

	const contentArray = buildContentArray({
		...state,
		streamingContent: newContent,
		streamingThinking: newThinking,
		streamingToolCalls: newToolCalls,
	});

	const preservedContent = getPreservedContent(
		state.currentStreamingMessage!.content || [],
	);

	return {
		streamingContent: newContent,
		streamingThinking: newThinking,
		streamingToolCalls: newToolCalls,
		currentStreamingMessage: {
			...state.currentStreamingMessage!,
			content: [...preservedContent, ...contentArray],
		},
	};
}

/**
 * 调度 RAF 更新
 */
function scheduleRafUpdate(
	getState: () => State,
	set: (
		fn: (state: State) => Partial<State>,
		replace?: boolean,
		action?: string,
	) => void,
) {
	if (rafId !== null) return;

	rafId = requestAnimationFrame(() => {
		const state = getState();
		const updates = applyRafUpdate(state, pendingContentUpdates);

		if (updates) {
			set(() => updates, false, "rafBatchUpdate");
		}

		pendingContentUpdates = {};
		rafId = null;
	});
}

// ============================================================================
// Store Creation
// ============================================================================

export const useChatStore = create<
	State & {
		// Input Actions
		setInputText: (text: string) => void;
		clearInput: () => void;

		// Message Actions
		addMessage: (message: Message) => void;
		setMessages: (messages: Message[]) => void;
		clearMessages: () => void;

		// Streaming Actions - Batch Updates
		startStreaming: () => void;
		createStreamingMessage: (messageId?: string) => void;
		startNewTurn: () => void;
		startContentBlock: (type: 'text' | 'thinking' | 'tool_use', index?: number, meta?: any) => void;
		endContentBlock: (type: 'text' | 'thinking' | 'tool_use', index?: number, meta?: any) => void;
		batchUpdateContent: (updates: {
			content?: string;
			thinking?: string;
			toolCall?: { id: string; name: string; delta: string };
		}) => void;
		abortStreaming: () => void;
		finishStreaming: () => void;

		// Tool Actions
		setActiveTool: (tool: ToolExecution) => void;
		updateToolOutput: (toolId: string, output: string, error?: string) => void;

		// UI State
		setShowThinking: (show: boolean) => void;
		setScrollToBottom: (scroll: boolean) => void;

		// Search
		setSearchQuery: (query: string) => void;
		setSearchFilters: (filters: Partial<ChatSearchFilters>) => void;
		setSearchResults: (results: SearchResult[]) => void;
		setSearching: (searching: boolean) => void;

		// Session
		setSessionId: (id: string | null) => void;
		setCurrentModel: (model: string | null) => void;

		// Reset
		reset: () => void;

		// Legacy compatibility
		appendStreamingContent: (text: string) => void;
		appendStreamingThinking: (thinking: string) => void;
		appendToolCallDelta: (id: string, name: string, delta: string) => void;
		updateMessage: (messageId: string, updates: Partial<Message>) => void;
		deleteMessage: (messageId: string) => void;
		toggleMessageCollapse: (messageId: string) => void;
		toggleThinkingCollapse: (messageId: string) => void;
		regenerateMessage: (messageId: string) => void;
		loadSession: (sessionPath: string) => Promise<number>;
	}
>()(
	devtools(
		(set, get) => ({
			...createInitialState(),

			// Input Actions
			setInputText: (text: string) => {
				set({ inputText: text }, false, "setInputText");
			},

			clearInput: () => {
				set({ inputText: "" }, false, "clearInput");
			},

			// Message Actions
			addMessage: (message: Message) => {
				set(
					(state) => ({ messages: [...state.messages, message] }),
					false,
					"addMessage",
				);
			},

			setMessages: (messages: Message[]) => {
				set({ messages, currentStreamingMessage: null }, false, "setMessages");
			},

			clearMessages: () => {
				set({ messages: [] }, false, "clearMessages");
			},

			// Streaming Actions - Optimized with batch updates
			startStreaming: () => {
				const streamingMessage: Message = {
					id: generateMessageId(),
					role: "assistant",
					content: [],
					timestamp: new Date(),
					isStreaming: true,
					isThinkingCollapsed: true, // 默认折叠思考内容
					isToolsCollapsed: true, // 默认折叠工具内容
				};
				set(
					{
						isStreaming: true,
						streamingContent: "",
						streamingThinking: "",
						streamingThinkings: [], // 初始化多轮思考
						streamingToolCalls: new Map(),
						activeTools: new Map(), // 清理上一次的工具状态
						currentStreamingMessage: streamingMessage,
					},
					false,
					"startStreaming",
				);
			},

			// 创建流式消息（使用服务器提供的ID）
			createStreamingMessage: (messageId?: string) => {
				const streamingMessage: Message = {
					id: messageId || generateMessageId(),
					role: "assistant",
					content: [],
					timestamp: new Date(),
					isStreaming: true,
					isThinkingCollapsed: true,
					isToolsCollapsed: true,
				};
				set(
					{
						isStreaming: true,
						streamingContent: "",
						streamingThinking: "",
						streamingThinkings: [],
						streamingToolCalls: new Map(),
						activeTools: new Map(),
						currentStreamingMessage: streamingMessage,
					},
					false,
					"createStreamingMessage",
				);
			},

			// 开始内容块
			startContentBlock: (type: 'text' | 'thinking' | 'tool_use', index?: number, meta?: any) => {
				console.log(`[ChatStore] startContentBlock: type=${type}, index=${index ?? '?'}`, meta);
				set(
					(state) => {
						if (!state.currentStreamingMessage) return {};

						// 根据类型初始化相应的内容块
						switch (type) {
							case 'thinking':
								// 开始新的思考块
								return { streamingThinking: "" };
							case 'text':
								// 文本块在 content_delta 时处理
								return {};
							case 'tool_use':
								// 工具调用块在 toolcall_delta 时初始化
								if (meta?.toolCallId && meta?.toolName) {
									const newToolCalls = new Map(state.streamingToolCalls);
									newToolCalls.set(meta.toolCallId, {
										id: meta.toolCallId,
										name: meta.toolName,
										args: "",
									});
									return { streamingToolCalls: newToolCalls };
								}
								return {};
						}
						return {};
					},
					false,
					"startContentBlock",
				);
			},

			// 结束内容块 - 将流式内容固化到 currentStreamingMessage.content，然后清空流式状态
			endContentBlock: (type: 'text' | 'thinking' | 'tool_use', index?: number, meta?: any) => {
				console.log(`[ChatStore] endContentBlock: type=${type}, index=${index ?? '?'}`, meta);
				
				set(
					(state) => {
						if (!state.currentStreamingMessage) return {};
						
						const existingContent = state.currentStreamingMessage.content || [];
						let newBlock: ContentPart | null = null;
						const updates: Partial<State> = {};
						
						switch (type) {
							case 'thinking':
								if (state.streamingThinking) {
									newBlock = { type: 'thinking', thinking: state.streamingThinking };
									updates.streamingThinking = "";
								}
								break;
							case 'text':
								if (state.streamingContent) {
									newBlock = { type: 'text', text: state.streamingContent };
									updates.streamingContent = "";
								}
								break;
							case 'tool_use':
								if (meta?.toolCallId) {
									const toolCall = state.streamingToolCalls.get(meta.toolCallId);
									if (toolCall) {
										newBlock = {
											type: 'tool_use',
											toolCallId: toolCall.id,
											toolName: toolCall.name,
											partialArgs: toolCall.args,
										};
										const newToolCalls = new Map(state.streamingToolCalls);
										newToolCalls.delete(meta.toolCallId);
										updates.streamingToolCalls = newToolCalls;
									}
								}
								break;
						}
						
						if (newBlock) {
							updates.currentStreamingMessage = {
								...state.currentStreamingMessage,
								content: [...existingContent, newBlock],
							};
						}
						
						return updates;
					},
					false,
					"endContentBlock",
				);
			},

			// 开始新的轮次 - 在 turn_start 时调用
			startNewTurn: () => {
				// 清空 RAF 批处理的待处理更新，避免旧内容被重复添加
				pendingContentUpdates = {};

				set(
					(state) => {
						if (!state.currentStreamingMessage) return {};

						// 先构建当前轮次的完整内容（包括工具）
						const currentContent = buildContentArray(state);

						// 添加轮次分隔标记
						currentContent.push({
							type: "turn_marker",
							turnNumber:
								currentContent.filter((c) => c.type === "turn_marker").length +
								1,
						});

						// 获取之前已保存的内容
						const existingContent = state.currentStreamingMessage.content || [];

						// 找到最后一个 turn_marker，保留它及之前的内容（之前轮次）
						const lastTurnMarkerIndex = existingContent
							.map((c: any) => c.type)
							.lastIndexOf("turn_marker");
						const previousRounds =
							lastTurnMarkerIndex >= 0
								? existingContent.slice(0, lastTurnMarkerIndex + 1)
								: []; // 第一轮不需要保留 existingContent，currentContent 已经包含了所有内容

						return {
							currentStreamingMessage: {
								...state.currentStreamingMessage,
								// 保留之前轮次 + 当前轮次（避免重复）
								content: [...previousRounds, ...currentContent],
							},
							// 清空当前轮次的流式状态，开始新一轮
							streamingThinking: "",
							streamingThinkings: [], // 清空多轮思考
							streamingContent: "",
							streamingToolCalls: new Map(),
							activeTools: new Map(),
						};
					},
					false,
					"startNewTurn",
				);
			},

			// Batch update - 合并所有更新一次性处理
			batchUpdateContent: (updates: {
				content?: string;
				thinking?: string;
				toolCall?: { id: string; name: string; delta: string };
			}) => {
				const state = get();
				if (!state.currentStreamingMessage) return;

				const newState = applyBatchUpdates(state, updates);

				set(newState, false, "batchUpdateContent");
			},

			// Streaming finalization helpers
			abortStreaming: () => finalizeStreaming(set, "abortStreaming"),
			finishStreaming: () => finalizeStreaming(set, "finishStreaming"),

			// Tools visibility
			showTools: true,
			setShowTools: (show: boolean) => {
				set({ showTools: show }, false, "setShowTools");
			},
			toggleToolsCollapse: (messageId: string) => {
				console.log("[ChatStore] toggleToolsCollapse called:", messageId);
				set(
					(state) => {
						const targetMsg = state.messages.find((m) => m.id === messageId);
						console.log(
							"[ChatStore] Target message found:",
							!!targetMsg,
							"current isToolsCollapsed:",
							targetMsg?.isToolsCollapsed,
						);

						const updatedMessages = state.messages.map((msg) =>
							msg.id === messageId
								? { ...msg, isToolsCollapsed: msg.isToolsCollapsed === false }
								: msg,
						);
						const updatedMsg = updatedMessages.find((m) => m.id === messageId);
						console.log(
							"[ChatStore] Updated isToolsCollapsed:",
							updatedMsg?.isToolsCollapsed,
						);

						// 同时更新 currentStreamingMessage
						const updatedStreamingMessage =
							state.currentStreamingMessage?.id === messageId
								? {
										...state.currentStreamingMessage,
										isToolsCollapsed:
											state.currentStreamingMessage.isToolsCollapsed === false,
									}
								: state.currentStreamingMessage;
						return {
							messages: updatedMessages,
							currentStreamingMessage: updatedStreamingMessage,
						};
					},
					false,
					"toggleToolsCollapse",
				);
			},
			// Tool Actions
			setActiveTool: (tool: ToolExecution) => {
				set(
					(state) => applyToolActivation(state, tool),
					false,
					"setActiveTool",
				);
			},

			updateToolOutput: (toolId: string, output: string, error?: string) => {
				set(
					(state) => applyToolCompletion(state, toolId, output, error),
					false,
					"updateToolOutput",
				);
			},

			// UI State
			setShowThinking: (show: boolean) => {
				set({ showThinking: show }, false, "setShowThinking");
			},

			setScrollToBottom: (scroll: boolean) => {
				set({ scrollToBottom: scroll }, false, "setScrollToBottom");
			},

			// Search
			setSearchQuery: (query: string) => {
				set({ searchQuery: query }, false, "setSearchQuery");
			},

			setSearchFilters: (filters: Partial<ChatSearchFilters>) => {
				set(
					(state) => ({
						searchFilters: { ...state.searchFilters, ...filters },
					}),
					false,
					"setSearchFilters",
				);
			},

			setSearchResults: (results: SearchResult[]) => {
				set(
					{
						searchResults: results,
						currentSearchIndex: results.length > 0 ? 0 : -1,
					},
					false,
					"setSearchResults",
				);
			},

			setSearching: (searching: boolean) => {
				set({ isSearching: searching }, false, "setSearching");
			},

			nextSearchResult: () => {
				const { searchResults, currentSearchIndex } = get();
				if (searchResults.length === 0) return;
				set(
					{
						currentSearchIndex: (currentSearchIndex + 1) % searchResults.length,
					},
					false,
					"nextSearchResult",
				);
			},

			prevSearchResult: () => {
				const { searchResults, currentSearchIndex } = get();
				if (searchResults.length === 0) return;
				set(
					{
						currentSearchIndex:
							(currentSearchIndex - 1 + searchResults.length) %
							searchResults.length,
					},
					false,
					"prevSearchResult",
				);
			},

			clearSearch: () => {
				set(
					{
						searchQuery: "",
						searchResults: [],
						currentSearchIndex: -1,
						isSearching: false,
					},
					false,
					"clearSearch",
				);
			},

			// Session
			setSessionId: (id: string | null) => {
				set({ sessionId: id }, false, "setSessionId");
			},

			setCurrentModel: (model: string | null) => {
				set({ currentModel: model }, false, "setCurrentModel");
			},

			// Reset
			reset: () => {
				set(createInitialState(), false, "reset");
			},

			// 直接同步更新流式状态，不用 RAF 批处理避免竞争
			appendStreamingContent: (text: string) => {
				set(
					(state) => ({
						streamingContent: state.streamingContent + text,
					}),
					false,
					"appendStreamingContent",
				);
			},

			appendStreamingThinking: (thinking: string) => {
				set(
					(state) => ({
						streamingThinking: state.streamingThinking + thinking,
					}),
					false,
					"appendStreamingThinking",
				);
			},

			appendToolCallDelta: (id: string, name: string, delta: string) => {
				set(
					(state) => {
						const newToolCalls = new Map(state.streamingToolCalls);
						const existing = newToolCalls.get(id);
						if (existing) {
							newToolCalls.set(id, { ...existing, args: existing.args + delta });
						} else {
							newToolCalls.set(id, { id, name, args: delta });
						}
						return { streamingToolCalls: newToolCalls };
					},
					false,
					"appendToolCallDelta",
				);
			},

			// Message collapse toggle
			toggleMessageCollapse: (messageId: string) => {
				set(
					(state) => ({
						messages: state.messages.map((msg) =>
							msg.id === messageId
								? { ...msg, isMessageCollapsed: !msg.isMessageCollapsed }
								: msg,
						),
					}),
					false,
					"toggleMessageCollapse",
				);
			},

			// Thinking collapse toggle
			toggleThinkingCollapse: (messageId: string) => {
				set(
					(state) => {
						const updatedMessages = state.messages.map((msg) =>
							msg.id === messageId
								? { ...msg, isThinkingCollapsed: !msg.isThinkingCollapsed }
								: msg,
						);
						// 同时更新 currentStreamingMessage
						const updatedStreamingMessage =
							state.currentStreamingMessage?.id === messageId
								? {
										...state.currentStreamingMessage,
										isThinkingCollapsed:
											!state.currentStreamingMessage.isThinkingCollapsed,
									}
								: state.currentStreamingMessage;
						return {
							messages: updatedMessages,
							currentStreamingMessage: updatedStreamingMessage,
						};
					},
					false,
					"toggleThinkingCollapse",
				);
			},

			// Load session messages from server
			loadSession: async (sessionPath: string) => {
				console.log("[ChatStore] loadSession called with path:", sessionPath);
				try {
					const response = await fetch("/api/session/load", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ sessionPath }),
					});

					if (!response.ok) {
						const errorData = await response.json().catch(() => ({}));
						console.error(
							"[ChatStore] Failed to load session:",
							response.status,
							response.statusText,
							errorData,
						);
						set({ messages: [] }, false, "loadSession/error");
						return 0;
					}

					const data = await response.json();
					if (!data.entries?.length) {
						set({ messages: [] }, false, "loadSession/empty");
						return 0;
					}

					// Helper: normalize content to array
					const normalizeContent = (rawContent: any): any[] => {
						if (!rawContent) return [];
						if (Array.isArray(rawContent)) return rawContent;
						if (typeof rawContent === "string")
							return [{ type: "text", text: rawContent }];
						if (typeof rawContent === "object") return [rawContent];
						return [{ type: "text", text: String(rawContent) }];
					};

					// Helper: normalize single content item
					const normalizeContentItem = (item: any): any => {
						if (!item || typeof item !== "object") {
							return { type: "text", text: String(item || "") };
						}

						const type = item.type || "text";
						switch (type) {
							case "thinking":
								return {
									type: "thinking" as const,
									thinking: item.thinking || item.text || "",
									signature: item.thinkingSignature || item.signature,
								};
							case "text":
								return { type: "text" as const, text: item.text || "" };
							case "toolCall":
							case "tool_use":
								return {
									type: "tool_use" as const,
									toolCallId:
										item.id || item.toolCallId || `tool-${Date.now()}`,
									toolName: item.name || item.toolName || "unknown",
									args: item.arguments || item.args || {},
									partialArgs: item.partialArgs,
								};
							case "toolResult":
							case "tool_result":
							case "tool": {
								// 处理 content 数组格式，提取文本
								let contentText = "";
								if (Array.isArray(item.content)) {
									contentText = item.content
										.filter((c: any) => c.type === "text")
										.map((c: any) => c.text)
										.join("");
								} else if (typeof item.content === "string") {
									contentText = item.content;
								}

								console.log("[normalize] toolResult:", {
									toolCallId: item.toolCallId,
									toolName: item.toolName,
									contentLength: contentText.length,
									isError: item.isError,
								});

								return {
									type: "tool" as const,
									toolCallId: item.toolCallId || item.id,
									toolName: item.toolName || item.name || "unknown",
									output: item.isError ? undefined : contentText || item.output,
									error: item.isError ? contentText || item.error : undefined,
									args: item.args,
								};
							}
							case "image":
								return {
									type: "image" as const,
									imageUrl: item.imageUrl || item.url || item.source?.data,
								};
							default:
								return {
									type: "text" as const,
									text: item.text || String(item),
								};
						}
					};

					// 调试：查看所有 entry 类型
					console.log(
						"[loadSession] All entries:",
						data.entries.map((e: any) => ({
							type: e.type,
							role: e.message?.role,
						})),
					);

					// 第一遍：收集所有 toolCall 的参数
					const toolCallArgsMap = new Map<string, any>();
					data.entries.forEach((entry: any) => {
						if (
							entry.type === "message" &&
							entry.message?.role === "assistant" &&
							Array.isArray(entry.message.content)
						) {
							entry.message.content.forEach((item: any) => {
								if (item.type === "toolCall" && item.id) {
									toolCallArgsMap.set(item.id, item.arguments || {});
									console.log(
										"[loadSession] Found toolCall:",
										item.id,
										item.name,
										item.arguments,
									);
								}
							});
						}
					});

					const loadedMessages = data.entries
						.filter((entry: any) => entry.type === "message" && entry.message)
						.map((entry: any) => {
							const msg = entry.message;

							// 调试
							console.log("[loadSession] Processing message:", {
								role: msg.role,
								id: entry.id,
							});

							// 特殊处理 toolResult 消息
							if (msg.role === "toolResult") {
								// 从 toolResult 创建 tool 类型的 content
								let contentText = "";
								if (Array.isArray(msg.content)) {
									contentText = msg.content
										.filter((c: any) => c.type === "text")
										.map((c: any) => c.text)
										.join("");
								} else if (typeof msg.content === "string") {
									contentText = msg.content;
								}

								// 查找对应的 toolCall 参数
								const args = toolCallArgsMap.get(msg.toolCallId) || {};
								console.log("[loadSession] toolResult message:", {
									toolCallId: msg.toolCallId,
									toolName: msg.toolName,
									contentLength: contentText.length,
									hasArgs: Object.keys(args).length > 0,
								});

								return {
									id:
										entry.id ||
										`msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
									role: "assistant" as const, // toolResult 转为 assistant
									content: [
										{
											type: "tool" as const,
											toolCallId: msg.toolCallId,
											toolName: msg.toolName,
											output: msg.isError ? undefined : contentText,
											error: msg.isError ? contentText : undefined,
											args: args,
										},
									],
									timestamp: new Date(
										msg.timestamp || entry.timestamp || Date.now(),
									),
									isStreaming: false,
									isThinkingCollapsed: true,
									isToolsCollapsed: true, // 默认折叠工具内容
									isMessageCollapsed: false,
								};
							}

							// 普通消息处理
							const rawContent = msg.content;
							const contentArray = normalizeContent(rawContent);

							// 过滤掉 toolCall，避免重复显示（toolResult 已经单独处理了）
							const filteredContent = contentArray.filter((item: any) => {
								// 跳过 toolCall 类型，避免和 toolResult 重复
								if (item.type === "toolCall") {
									console.log(
										"[loadSession] Filtering out toolCall from assistant message:",
										item.id,
									);
									return false;
								}
								return true;
							});

							const normalizedContent =
								filteredContent.map(normalizeContentItem);

							return {
								id:
									entry.id ||
									`msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
								role: msg.role || "assistant",
								content: normalizedContent,
								timestamp: new Date(
									msg.timestamp || entry.timestamp || Date.now(),
								),
								isStreaming: false,
								isThinkingCollapsed: true,
								isToolsCollapsed: true, // 默认折叠工具内容
								isMessageCollapsed: false,
							};
						});

					console.log(`[ChatStore] Loaded ${loadedMessages.length} messages`);

					// 调试：检查工具消息
					loadedMessages.forEach((msg, idx) => {
						const toolContent = msg.content.filter(
							(c: any) => c.type === "tool",
						);
						if (toolContent.length > 0) {
							console.log(
								`[ChatStore] Message ${idx} has ${toolContent.length} tool blocks:`,
							);
							toolContent.forEach((t: any, i: number) => {
								console.log(
									`  Tool[${i}]: name=${t.toolName}, hasOutput=${!!t.output}, hasError=${!!t.error}`,
								);
							});
						}
					});

					set(
						{ messages: loadedMessages, currentStreamingMessage: null },
						false,
						"loadSession",
					);
					return loadedMessages.length;
				} catch (err) {
					console.error("[ChatStore] Failed to load session:", err);
					set({ messages: [] }, false, "loadSession/error");
					return 0;
				}
			},

			// Stub methods for compatibility
			updateMessage: () => {},
			deleteMessage: () => {},
			regenerateMessage: () => {},
		}),
		{ name: "ChatStore" },
	),
);

// ============================================================================
// Selectors for Zustand - 优化重渲染性能
// ============================================================================

export const selectMessages = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.messages;
export const selectCurrentStreamingMessage = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.currentStreamingMessage;
export const selectInputText = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.inputText;
export const selectIsStreaming = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.isStreaming;
export const selectShowThinking = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.showThinking;
export const selectShowTools = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.showTools;
export const selectSearchQuery = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.searchQuery;
export const selectSearchFilters = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.searchFilters;
export const selectSearchResults = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.searchResults;
export const selectCurrentSearchIndex = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.currentSearchIndex;
export const selectIsSearching = (
	state: ReturnType<typeof useChatStore.getState>,
) => state.isSearching;

// ============================================================================
// Message Filtering Helper
// ============================================================================

export interface FilterOptions {
	query: string;
	filters: {
		user: boolean;
		assistant: boolean;
		thinking: boolean;
		tools: boolean;
	};
}

/**
 * 过滤消息列表
 * @param messages 消息列表
 * @param options 过滤选项
 * @returns 过滤后的消息列表
 */
export function filterMessages(
	messages: Message[],
	options: FilterOptions,
): Message[] {
	const { query, filters } = options;
	const lowerQuery = query.toLowerCase().trim();

	return messages.filter((message) => {
		// 1. 按消息类型过滤
		if (message.role === "user" && !filters.user) return false;
		if (message.role === "assistant" && !filters.assistant) return false;

		// 2. 对于 assistant 消息，检查内容类型
		if (message.role === "assistant") {
			const hasThinking = message.content.some((c) => c.type === "thinking");
			const hasTools = message.content.some(
				(c) => c.type === "tool" || c.type === "tool_use",
			);

			// 如果消息包含 thinking 但 filters.thinking 为 false，且没有文本内容，则过滤掉
			if (
				hasThinking &&
				!filters.thinking &&
				!message.content.some((c) => c.type === "text")
			) {
				return false;
			}

			// 如果消息包含 tools 但 filters.tools 为 false，且没有文本内容，则过滤掉
			if (
				hasTools &&
				!filters.tools &&
				!message.content.some((c) => c.type === "text")
			) {
				return false;
			}
		}

		// 3. 按搜索关键词过滤（如果有关键词）
		if (lowerQuery) {
			const messageText = message.content
				.map((c) => {
					if (c.type === "text") return c.text || "";
					if (c.type === "thinking") return c.thinking || "";
					if (c.type === "tool" || c.type === "tool_use") {
						return `${c.toolName || ""} ${JSON.stringify(c.args || {})} ${c.output || ""}`;
					}
					return "";
				})
				.join(" ")
				.toLowerCase();

			return messageText.includes(lowerQuery);
		}

		return true;
	});
}

/**
 * Selector: 获取过滤后的消息
 */
export const selectFilteredMessages = (options: FilterOptions) => {
	return (state: ReturnType<typeof useChatStore.getState>): Message[] => {
		return filterMessages(state.messages, options);
	};
};
