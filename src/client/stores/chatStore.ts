/**
 * Chat Store - Zustand State Management
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
	ChatSearchFilters,
	ChatState,
	Message,
	MessageContent,
	ToolExecution,
} from "@/types/chat";

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = (): Omit<
	ChatState,
	| "setInputText"
	| "clearInput"
	| "addMessage"
	| "updateMessage"
	| "deleteMessage"
	| "clearMessages"
	| "setMessages"
	| "toggleMessageCollapse"
	| "toggleThinkingCollapse"
	| "setShowThinking"
	| "startStreaming"
	| "appendStreamingContent"
	| "appendStreamingThinking"
	| "abortStreaming"
	| "finishStreaming"
	| "setActiveTool"
	| "updateToolOutput"
	| "setSessionId"
	| "loadSession"
	| "reset"
	| "setScrollToBottom"
	| "setSearchQuery"
	| "setSearchFilters"
	| "regenerateMessage"
> => ({
	messages: [],
	currentStreamingMessage: null,
	inputText: "",
	isInputFocused: false,
	isStreaming: false,
	streamingContent: "",
	streamingThinking: "",
	activeTools: new Map(),
	showThinking: true,
	scrollToBottom: false,
	searchQuery: "",
	searchFilters: {
		user: true,
		assistant: true,
		thinking: true,
		tools: true,
	},
	searchResults: [],
	isSearching: false,
	currentModel: null,
	sessionId: null,
});

// ============================================================================
// Message ID Generator
// ============================================================================

function generateMessageId(): string {
	return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Store Creation
// ============================================================================

export const useChatStore = create<ChatState>()(
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
					(state) => ({
						messages: [...state.messages, message],
					}),
					false,
					"addMessage",
				);
			},

			updateMessage: (messageId: string, updates: Partial<Message>) => {
				set(
					(state) => ({
						messages: state.messages.map((m) =>
							m.id === messageId ? { ...m, ...updates } : m,
						),
					}),
					false,
					"updateMessage",
				);
			},

			deleteMessage: (messageId: string) => {
				set(
					(state) => ({
						messages: state.messages.filter((m) => m.id !== messageId),
					}),
					false,
					"deleteMessage",
				);
			},

			clearMessages: () => {
				set(
					{ messages: [], currentStreamingMessage: null },
					false,
					"clearMessages",
				);
			},

			setMessages: (messages: Message[]) => {
				set({ messages, currentStreamingMessage: null }, false, "setMessages");
			},

			toggleMessageCollapse: (messageId: string) => {
				set(
					(state) => ({
						messages: state.messages.map((m) =>
							m.id === messageId
								? { ...m, isMessageCollapsed: !m.isMessageCollapsed }
								: m,
						),
					}),
					false,
					"toggleMessageCollapse",
				);
			},

			toggleThinkingCollapse: (messageId: string) => {
				set(
					(state) => ({
						messages: state.messages.map((m) =>
							m.id === messageId
								? { ...m, isThinkingCollapsed: !m.isThinkingCollapsed }
								: m,
						),
					}),
					false,
					"toggleThinkingCollapse",
				);
			},

			// Streaming Actions
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
						currentStreamingMessage: streamingMessage,
					},
					false,
					"startStreaming",
				);
			},

			appendStreamingContent: (text: string) => {
				set(
					(state) => ({
						streamingContent: state.streamingContent + text,
						currentStreamingMessage: state.currentStreamingMessage
							? {
									...state.currentStreamingMessage,
									content: [
										{ type: "text", text: state.streamingContent + text },
									],
								}
							: null,
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

			abortStreaming: () => {
				set(
					(state) => ({
						isStreaming: false,
						messages: state.currentStreamingMessage
							? [...state.messages, state.currentStreamingMessage]
							: state.messages,
						currentStreamingMessage: null,
						streamingContent: "",
						streamingThinking: "",
					}),
					false,
					"abortStreaming",
				);
			},

			finishStreaming: () => {
				set(
					(state) => ({
						isStreaming: false,
						messages: state.currentStreamingMessage
							? [
									...state.messages,
									{ ...state.currentStreamingMessage, isStreaming: false },
								]
							: state.messages,
						currentStreamingMessage: null,
						streamingContent: "",
						streamingThinking: "",
					}),
					false,
					"finishStreaming",
				);
			},

			// Alias for test compatibility
			finalizeStreamingMessage: function () {
				return this.finishStreaming();
			},

			// Tool Actions
			setActiveTool: (tool: ToolExecution) => {
				set(
					(state) => ({
						activeTools: new Map(state.activeTools).set(tool.id, tool),
					}),
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

			// Load session from server
			loadSession: async (sessionPath: string) => {
				try {
					const response = await fetch(
						`/api/session?path=${encodeURIComponent(sessionPath)}`,
					);
					if (!response.ok) throw new Error("Failed to load session");

					const data = await response.json();
					const sessionMessages: any[] = data.messages || [];

					// Parse session messages
					const parsedMessages: Message[] = [];
					const tools: ToolExecution[] = [];

					// First pass: parse all messages and create a map for parent lookup
					const messageMap = new Map<string, Message>();

					for (const entry of sessionMessages) {
						if (entry.type === "message" && entry.message) {
							const msg = entry.message;
							const content: MessageContent[] = [];

							// Parse message content
							if (msg.content && Array.isArray(msg.content)) {
								for (const c of msg.content) {
									if (c.type === "text" && c.text) {
										content.push({ type: "text", text: c.text });
									} else if (c.type === "thinking" && c.thinking) {
										content.push({
											type: "thinking",
											thinking: c.thinking,
											signature: c.thinkingSignature,
										});
									} else if (c.type === "toolCall" && c.id) {
										// Tool call from session file uses 'name' and 'arguments'
										content.push({
											type: "tool",
											toolCallId: c.id,
											toolName: c.name || "unknown",
											args: c.arguments || {},
										});
									}
									// Note: toolResult is handled separately in second pass
								}
							}

							const parsedMsg: Message = {
								id: entry.id || generateMessageId(),
								role: msg.role,
								content,
								timestamp: new Date(entry.timestamp || msg.timestamp),
								isMessageCollapsed: false,
								isThinkingCollapsed: true,
							};

							parsedMessages.push(parsedMsg);
							messageMap.set(parsedMsg.id, parsedMsg);
						} else if (entry.type === "tool_start") {
							tools.push({
								id: entry.toolCallId,
								name: entry.toolName,
								args: entry.args || {},
								status: "executing",
								startTime: new Date(entry.timestamp),
							});
						} else if (entry.type === "tool_end") {
							const tool = tools.find((t) => t.id === entry.toolCallId);
							if (tool) {
								tool.status = entry.error ? "error" : "success";
								tool.output = entry.output;
								tool.error = entry.error;
								tool.endTime = new Date(entry.timestamp);
							}
						}
					}

					// Second pass: handle toolResult messages
					for (const entry of sessionMessages) {
						if (
							entry.type === "message" &&
							entry.message?.role === "toolResult" &&
							entry.parentId
						) {
							const parentMsg = messageMap.get(entry.parentId);
							if (parentMsg && entry.message.toolCallId) {
								// Find the tool content in parent message and update it
								const toolContent = parentMsg.content.find(
									(tc) =>
										tc.type === "tool" &&
										tc.toolCallId === entry.message.toolCallId,
								);
								if (toolContent) {
									toolContent.output = entry.message.content?.[0]?.text || "";
									toolContent.error = entry.message.isError
										? "Error occurred"
										: undefined;
								}
							}
						}
					}

					// Update store
					set(
						{
							messages: parsedMessages,
							sessionId: sessionPath,
							activeTools: new Map(tools.map((t) => [t.id, t])),
						},
						false,
						"loadSession",
					);

					return parsedMessages.length;
				} catch (error) {
					console.error("Failed to load session:", error);
					throw error;
				}
			},

			// Regenerate message
			regenerateMessage: (messageId: string) => {
				const state = get();
				const messageIndex = state.messages.findIndex(
					(m) => m.id === messageId,
				);
				if (messageIndex === -1) return;

				// Find the user message that triggered this assistant message
				let userMessageIndex = -1;
				for (let i = messageIndex - 1; i >= 0; i--) {
					if (state.messages[i].role === "user") {
						userMessageIndex = i;
						break;
					}
				}

				if (userMessageIndex === -1) return;

				// Remove all messages from the assistant message onwards
				const newMessages = state.messages.slice(0, messageIndex);

				set(
					{
						messages: newMessages,
						isStreaming: true,
						currentStreamingMessage: {
							id: generateMessageId(),
							role: "assistant",
							content: [],
							timestamp: new Date(),
							isStreaming: true,
						},
					},
					false,
					"regenerateMessage",
				);

				// Trigger regeneration via WebSocket
				const userMessage = newMessages[userMessageIndex];
				const text = userMessage.content.find((c) => c.type === "text")?.text;
				if (text) {
					// Send via WebSocket - this would be handled by the API layer
					if (typeof window !== "undefined") {
						window.dispatchEvent(
							new CustomEvent("chat:resend", { detail: { text } }),
						);
					}
				}
			},

			// Reset
			reset: () => {
				set(createInitialState(), false, "reset");
			},
		}),
		{ name: "ChatStore" },
	),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectMessages = (state: ChatState) => state.messages;
export const selectCurrentStreamingMessage = (state: ChatState) =>
	state.currentStreamingMessage;
export const selectInputText = (state: ChatState) => state.inputText;
export const selectIsStreaming = (state: ChatState) => state.isStreaming;
export const selectShowThinking = (state: ChatState) => state.showThinking;
export const selectActiveTools = (state: ChatState) => state.activeTools;
