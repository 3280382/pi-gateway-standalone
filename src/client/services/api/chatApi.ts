/**
 * Chat API - Controller Layer
 * Connects Zustand Store with Backend WebSocket
 */

import { useChatStore } from "@/stores/chatStore";
import type { ChatController, Message, ToolExecution } from "@/types/chat";
import { wsClient } from "./client";

// ============================================================================
// Message ID Generator
// ============================================================================

function generateMessageId(): string {
	return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateToolId(): string {
	return `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Controller Hook
// ============================================================================

export function useChatController(): ChatController {
	const store = useChatStore();

	return {
		sendMessage: async (text: string) => {
			if (!text.trim()) return;

			// Add user message
			const userMessage: Message = {
				id: generateMessageId(),
				role: "user",
				content: [{ type: "text", text }],
				timestamp: new Date(),
			};

			store.addMessage(userMessage);
			store.clearInput();
			store.startStreaming();

			// Send via WebSocket
			wsClient.send({
				type: "prompt",
				text,
			});

			// Setup message handlers for streaming response
			setupStreamingHandlers(store);
		},

		abortGeneration: () => {
			wsClient.send({ type: "abort" });
			store.abortStreaming();
		},

		setInputText: (text: string) => {
			store.setInputText(text);
		},

		clearInput: () => {
			store.clearInput();
		},

		toggleMessageCollapse: (messageId: string) => {
			store.toggleMessageCollapse(messageId);
		},

		toggleThinkingCollapse: (messageId: string) => {
			store.toggleThinkingCollapse(messageId);
		},

		deleteMessage: (messageId: string) => {
			store.deleteMessage(messageId);
		},

		clearMessages: () => {
			store.clearMessages();
		},

		regenerateMessage: (messageId: string) => {
			store.regenerateMessage(messageId);
		},

		setShowThinking: (show: boolean) => {
			store.setShowThinking(show);
		},

		expandToolOutput: (_toolId: string) => {
			// Tool output expansion is handled in component state
			// This could be moved to store if needed globally
		},

		collapseToolOutput: (_toolId: string) => {
			// Tool output collapse is handled in component state
		},
	};
}

// ============================================================================
// Streaming Handlers Setup
// ============================================================================

function setupStreamingHandlers(
	store: ReturnType<typeof useChatStore.getState>,
) {
	// Track handlers so we can clean them up
	const handlers: (() => void)[] = [];

	// Content delta handler
	const contentHandler = wsClient.on("content", (data) => {
		store.appendStreamingContent(data.text);
	});
	handlers.push(contentHandler);

	// Thinking delta handler
	const thinkingHandler = wsClient.on("thinking", (data) => {
		store.appendStreamingThinking(data.thinking);
	});
	handlers.push(thinkingHandler);

	// Tool call delta handler
	const toolCallHandler = wsClient.on("toolcall_delta", (data) => {
		// Handle tool call streaming if needed
		console.log("[ChatController] Tool call delta:", data);
	});
	handlers.push(toolCallHandler);

	// Tool start handler
	const toolStartHandler = wsClient.on("tool_start", (data) => {
		const tool: ToolExecution = {
			id: data.toolCallId || generateToolId(),
			name: data.toolName,
			args: data.args || {},
			status: "executing",
			startTime: new Date(),
		};
		store.addToolExecution(tool);
	});
	handlers.push(toolStartHandler);

	// Tool update handler
	const toolUpdateHandler = wsClient.on("tool_update", (data) => {
		if (data.output) {
			store.updateToolStatus(data.toolCallId, "success", data.output);
		} else if (data.error) {
			store.updateToolStatus(data.toolCallId, "error", undefined, data.error);
		}
	});
	handlers.push(toolUpdateHandler);

	// Tool end handler
	const toolEndHandler = wsClient.on("tool_end", (data) => {
		if (data.error) {
			store.updateToolStatus(data.toolCallId, "error", undefined, data.error);
		} else {
			store.updateToolStatus(data.toolCallId, "success", data.output);
		}
	});
	handlers.push(toolEndHandler);

	// Agent end handler - finalize streaming
	const agentEndHandler = wsClient.on("agent_end", () => {
		store.finalizeStreamingMessage();

		// Clean up all handlers
		for (const unsubscribe of handlers) {
			unsubscribe();
		}
	});
	handlers.push(agentEndHandler);

	// Error handler
	const errorHandler = wsClient.on("error", (data) => {
		console.error("[ChatController] WebSocket error:", data);
		store.abortStreaming();
		for (const unsubscribe of handlers) {
			unsubscribe();
		}
	});
	handlers.push(errorHandler);
}

// ============================================================================
// Non-hook API for non-React contexts
// ============================================================================

export function createChatController(): ChatController {
	const store = useChatStore.getState();

	return {
		sendMessage: async (text: string) => {
			if (!text.trim()) return;

			const userMessage: Message = {
				id: generateMessageId(),
				role: "user",
				content: [{ type: "text", text }],
				timestamp: new Date(),
			};

			store.addMessage(userMessage);
			store.clearInput();
			store.startStreaming();

			wsClient.send({
				type: "prompt",
				text,
			});

			setupStreamingHandlers(store);
		},

		abortGeneration: () => {
			wsClient.send({ type: "abort" });
			store.abortStreaming();
		},

		setInputText: (text: string) => store.setInputText(text),
		clearInput: () => store.clearInput(),
		toggleMessageCollapse: (id: string) => store.toggleMessageCollapse(id),
		toggleThinkingCollapse: (id: string) => store.toggleThinkingCollapse(id),
		deleteMessage: (id: string) => store.deleteMessage(id),
		clearMessages: () => store.clearMessages(),
		regenerateMessage: (id: string) => store.regenerateMessage(id),
		setShowThinking: (show: boolean) => store.setShowThinking(show),
		expandToolOutput: () => {},
		collapseToolOutput: () => {},
	};
}
