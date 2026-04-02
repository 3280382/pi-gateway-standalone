/**
 * Chat Store - Zustand State Management with Performance Optimizations
 * 使用批量更新和RAF调度优化流式消息性能
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
	ChatSearchFilters,
	ChatState,
	Message,
	ToolExecution,
} from "@/types/chat";

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
	searchResults: [] as string[],
	isSearching: false,
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
// Helper: Build content array preserving temporal order
// ============================================================================

// 用于追踪内容块的插入顺序
let contentOrderCounter = 0;

interface ContentPartWithOrder extends ContentPart {
	_order: number;
}

function buildContentArray(state: State): ContentPart[] {
	const content: ContentPartWithOrder[] = [];

	// 1. 思考内容 - 支持多轮思考
	if (state.streamingThinkings.length > 0) {
		state.streamingThinkings.forEach((thinking) => {
			if (thinking.content) {
				content.push({
					type: "thinking",
					thinking: thinking.content,
					_order: thinking.id
						? parseInt(thinking.id.split("-")[1]) || contentOrderCounter++
						: contentOrderCounter++,
				});
			}
		});
	} else if (state.streamingThinking) {
		content.push({
			type: "thinking",
			thinking: state.streamingThinking,
			_order: contentOrderCounter++,
		});
	}

	// 2. 文本内容 - 放在思考之后但在工具之前（如果文本是主要的）
	if (state.streamingContent) {
		content.push({
			type: "text",
			text: state.streamingContent,
			_order: contentOrderCounter++,
		});
	}

	// 3. 工具内容 - 合并 tool_use 和 tool 为统一的显示
	// 优先使用已完成的工具（有输出或错误）
	state.activeTools.forEach((tool) => {
		content.push({
			type: "tool",
			toolCallId: tool.id,
			toolName: tool.name,
			args: tool.args,
			output: tool.output,
			error: tool.error,
			_order: tool.startTime ? tool.startTime.getTime() : contentOrderCounter++,
		});
	});

	// 对于仍在流式构建中的工具调用，只在还没有完成版本时添加
	state.streamingToolCalls.forEach((tool) => {
		// 检查是否已经有完成的版本
		const completedTool = state.activeTools.get(tool.id);
		if (!completedTool) {
			content.push({
				type: "tool_use",
				toolCallId: tool.id,
				toolName: tool.name,
				partialArgs: tool.args,
				_order: contentOrderCounter++,
			});
		}
	});

	// 按时间顺序排序并返回（移除 _order 字段）
	return content
		.sort((a, b) => a._order - b._order)
		.map(({ _order, ...rest }) => rest as ContentPart);
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
		startNewTurn: () => void;
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

		// Session
		setSessionId: (id: string | null) => void;

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

			// 开始新的轮次 - 在 turn_start 时调用
			startNewTurn: () => {
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

						return {
							currentStreamingMessage: {
								...state.currentStreamingMessage,
								content: currentContent,
							},
							// 清空当前轮次的流式状态，开始新一轮
							streamingThinking: "",
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

				// 累积更新
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

				// 只更新一次状态
				const contentArray = buildContentArray({
					...state,
					streamingContent: newContent,
					streamingThinking: newThinking,
					streamingToolCalls: newToolCalls,
				});

				set(
					{
						streamingContent: newContent,
						streamingThinking: newThinking,
						streamingToolCalls: newToolCalls,
						currentStreamingMessage: {
							...state.currentStreamingMessage,
							content: contentArray,
						},
					},
					false,
					"batchUpdateContent",
				);
			},

			abortStreaming: () => {
				set(
					(state) => {
						// 确保最终内容包含所有工具数据
						const finalContent = buildContentArray(state);
						const finalMessage = state.currentStreamingMessage
							? {
									...state.currentStreamingMessage,
									content: finalContent,
								}
							: null;

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
					"abortStreaming",
				);
			},

			finishStreaming: () => {
				set(
					(state) => {
						// 确保最终内容包含所有工具数据
						const finalContent = buildContentArray(state);
						const finalMessage = state.currentStreamingMessage
							? {
									...state.currentStreamingMessage,
									content: finalContent,
									isStreaming: false,
								}
							: null;

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
					"finishStreaming",
				);
			},

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
					(state) => {
						// 保留 streamingToolCalls 中的参数（如果有）
						const streamingTool = state.streamingToolCalls.get(tool.id);
						const mergedTool = streamingTool
							? {
									...tool,
									args: { ...tool.args, _streamingArgs: streamingTool.args },
								}
							: tool;

						const newTools = new Map(state.activeTools).set(
							tool.id,
							mergedTool,
						);

						// 当工具开始执行时，从 streamingToolCalls 中移除
						// 这样可以避免 tool_use 和 tool 重复显示
						const newStreamingToolCalls = new Map(state.streamingToolCalls);
						newStreamingToolCalls.delete(tool.id);

						// 同时更新当前流式消息
						if (state.currentStreamingMessage) {
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

						return {
							activeTools: newTools,
							streamingToolCalls: newStreamingToolCalls,
						};
					},
					false,
					"setActiveTool",
				);
			},

			updateToolOutput: (toolId: string, output: string, error?: string) => {
				set(
					(state) => {
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

						// 同时更新当前流式消息
						if (state.currentStreamingMessage) {
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

						return { activeTools: newTools };
					},
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

			// Session
			setSessionId: (id: string | null) => {
				set({ sessionId: id }, false, "setSessionId");
			},

			// Reset
			reset: () => {
				set(createInitialState(), false, "reset");
			},

			// Legacy compatibility methods
			appendStreamingContent: (text: string) => {
				get().batchUpdateContent({ content: text });
			},

			appendStreamingThinking: (thinking: string) => {
				get().batchUpdateContent({ thinking });
			},

			appendToolCallDelta: (id: string, name: string, delta: string) => {
				get().batchUpdateContent({ toolCall: { id, name, delta } });
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
				try {
					const response = await fetch("/api/session/load", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ sessionPath }),
					});

					if (!response.ok) {
						console.error(
							"[ChatStore] Failed to load session:",
							response.statusText,
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
