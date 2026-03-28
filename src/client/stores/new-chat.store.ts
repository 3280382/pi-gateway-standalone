/**
 * New Chat Store - 精简版状态管理
 * 只负责状态管理，业务逻辑移到Service层
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ChatState, Message, ToolExecution } from "@/types/chat";

// ============================================================================
// Initial State
// ============================================================================

const initialState: ChatState = {
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
};

// ============================================================================
// Store Interface
// ============================================================================

interface ChatStoreActions {
	// State setters
	setMessages: (messages: Message[]) => void;
	addMessage: (message: Message) => void;
	updateMessage: (messageId: string, updates: Partial<Message>) => void;
	deleteMessage: (messageId: string) => void;
	clearMessages: () => void;

	// Input state
	setInputText: (text: string) => void;
	setInputFocus: (focused: boolean) => void;
	clearInput: () => void;

	// Streaming state
	setStreaming: (streaming: boolean) => void;
	setCurrentStreamingMessage: (message: Message | null) => void;
	setStreamingContent: (content: string) => void;
	setStreamingThinking: (thinking: string) => void;
	appendStreamingContent: (content: string) => void;
	appendStreamingThinking: (thinking: string) => void;
	resetStreaming: () => void;

	// Tools state
	setActiveTool: (toolId: string, tool: ToolExecution) => void;
	updateActiveTool: (toolId: string, updates: Partial<ToolExecution>) => void;
	removeActiveTool: (toolId: string) => void;
	clearActiveTools: () => void;

	// UI state
	setShowThinking: (show: boolean) => void;
	setScrollToBottom: (scroll: boolean) => void;
	toggleMessageCollapse: (messageId: string) => void;
	toggleThinkingCollapse: (messageId: string) => void;

	// Search state
	setSearchQuery: (query: string) => void;
	setSearchFilters: (filters: Partial<ChatState["searchFilters"]>) => void;
	setSearchResults: (results: string[]) => void;
	setSearching: (searching: boolean) => void;

	// Session state
	setCurrentModel: (model: string | null) => void;
	setSessionId: (sessionId: string | null) => void;

	// Reset
	reset: () => void;
}

type ChatStore = ChatState & ChatStoreActions;

// ============================================================================
// Store Creation
// ============================================================================

export const useNewChatStore = create<ChatStore>()(
	devtools(
		(set, get) => ({
			...initialState,

			// Message actions
			setMessages: (messages) => set({ messages }),
			addMessage: (message) =>
				set((state) => ({
					messages: [...state.messages, message],
				})),
			updateMessage: (messageId, updates) =>
				set((state) => ({
					messages: state.messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
				})),
			deleteMessage: (messageId) =>
				set((state) => ({
					messages: state.messages.filter((m) => m.id !== messageId),
				})),
			clearMessages: () =>
				set({
					messages: [],
					currentStreamingMessage: null,
				}),

			// Input actions
			setInputText: (text) => set({ inputText: text }),
			setInputFocus: (focused) => set({ isInputFocused: focused }),
			clearInput: () => set({ inputText: "" }),

			// Streaming actions
			setStreaming: (streaming) => set({ isStreaming: streaming }),
			setCurrentStreamingMessage: (message) => set({ currentStreamingMessage: message }),
			setStreamingContent: (content) => set({ streamingContent: content }),
			setStreamingThinking: (thinking) => set({ streamingThinking: thinking }),
			appendStreamingContent: (content) =>
				set((state) => ({
					streamingContent: state.streamingContent + content,
				})),
			appendStreamingThinking: (thinking) =>
				set((state) => ({
					streamingThinking: state.streamingThinking + thinking,
				})),
			resetStreaming: () =>
				set({
					isStreaming: false,
					streamingContent: "",
					streamingThinking: "",
					currentStreamingMessage: null,
				}),

			// Tools actions
			setActiveTool: (toolId, tool) =>
				set((state) => {
					const newTools = new Map(state.activeTools);
					newTools.set(toolId, tool);
					return { activeTools: newTools };
				}),
			updateActiveTool: (toolId, updates) =>
				set((state) => {
					const tool = state.activeTools.get(toolId);
					if (!tool) return state;

					const newTools = new Map(state.activeTools);
					newTools.set(toolId, { ...tool, ...updates });
					return { activeTools: newTools };
				}),
			removeActiveTool: (toolId) =>
				set((state) => {
					const newTools = new Map(state.activeTools);
					newTools.delete(toolId);
					return { activeTools: newTools };
				}),
			clearActiveTools: () => set({ activeTools: new Map() }),

			// UI actions
			setShowThinking: (show) => set({ showThinking: show }),
			setScrollToBottom: (scroll) => set({ scrollToBottom: scroll }),
			toggleMessageCollapse: (messageId) =>
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === messageId ? { ...m, isMessageCollapsed: !m.isMessageCollapsed } : m,
					),
				})),
			toggleThinkingCollapse: (messageId) =>
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === messageId ? { ...m, isThinkingCollapsed: !m.isThinkingCollapsed } : m,
					),
				})),

			// Search actions
			setSearchQuery: (query) => set({ searchQuery: query }),
			setSearchFilters: (filters) =>
				set((state) => ({
					searchFilters: { ...state.searchFilters, ...filters },
				})),
			setSearchResults: (results) => set({ searchResults: results }),
			setSearching: (searching) => set({ isSearching: searching }),

			// Session actions
			setCurrentModel: (model) => set({ currentModel: model }),
			setSessionId: (sessionId) => set({ sessionId }),

			// Reset
			reset: () => set(initialState),
		}),
		{ name: "ChatStore" },
	),
);

// ============================================================================
// Selectors (for better performance)
// ============================================================================

export const chatStoreSelectors = {
	// Message selectors
	getMessageById: (id: string) => (state: ChatStore) => state.messages.find((m) => m.id === id),

	getLastMessage: (state: ChatStore) => (state.messages.length > 0 ? state.messages[state.messages.length - 1] : null),

	getUserMessages: (state: ChatStore) => state.messages.filter((m) => m.role === "user"),

	getAssistantMessages: (state: ChatStore) => state.messages.filter((m) => m.role === "assistant"),

	// Tool selectors
	getToolById: (id: string) => (state: ChatStore) => state.activeTools.get(id),

	getAllTools: (state: ChatStore) => Array.from(state.activeTools.values()),

	getActiveToolCount: (state: ChatStore) => state.activeTools.size,

	// Search selectors
	getFilteredMessages: (state: ChatStore) => {
		const { messages, searchQuery, searchFilters } = state;

		if (!searchQuery) return messages;

		const query = searchQuery.toLowerCase();
		return messages.filter((message) => {
			// Filter by role
			if (message.role === "user" && !searchFilters.user) return false;
			if (message.role === "assistant" && !searchFilters.assistant) return false;

			// Search in content
			const hasMatchingContent = message.content.some((content) => {
				const text = content.text || content.thinking || content.output || "";
				return text.toLowerCase().includes(query);
			});

			return hasMatchingContent;
		});
	},

	// UI selectors
	shouldScrollToBottom: (state: ChatStore) => state.scrollToBottom && !state.isSearching,

	// Computed values
	getMessageCount: (state: ChatStore) => state.messages.length,
	getWordCount: (state: ChatStore) => {
		let count = 0;
		state.messages.forEach((message) => {
			message.content.forEach((content) => {
				const text = content.text || content.thinking || content.output || "";
				count += text.split(/\s+/).length;
			});
		});
		return count;
	},
};
