/**
 * useChat - Chat Hook for Managing Chat State and Operations
 * Features:
 * - Send messages with slash command and bash command processing
 * - Abort ongoing generation
 * - Handle streaming responses
 * - Tool call state management
 * - Message history management
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { hookLog, wsLog } from "@/lib/logger";
import type {
	AgentEndMessage,
	AgentStartMessage,
	ChatWebSocketMessage,
	ContentDeltaMessage,
	Message,
	MessageContent,
	ThinkingDeltaMessage,
	ToolEndMessage,
	ToolExecution,
	ToolStartMessage,
	ToolUpdateMessage,
} from "@/types/chat";
import { wsClient } from "../api/client";

// ============================================================================
// Types
// ============================================================================

export interface UseChatReturn {
	// State
	messages: Message[];
	currentStreamingMessage: Message | null;
	inputText: string;
	isStreaming: boolean;
	showThinking: boolean;
	activeTools: Map<string, ToolExecution>;

	// Actions
	setInputText: (text: string) => void;
	sendMessage: () => void;
	abortGeneration: () => void;
	clearMessages: () => void;
	toggleMessageCollapse: (messageId: string) => void;
	toggleThinkingCollapse: (messageId: string) => void;
	setShowThinking: (show: boolean) => void;

	// Tool actions
	getToolStatus: (toolId: string) => ToolExecution | undefined;
	expandToolOutput: (toolId: string) => void;
	collapseToolOutput: (toolId: string) => void;

	// Utils
	isBashCommand: (text: string) => boolean;
	getSlashCommand: (text: string) => string | null;
}

interface StreamingState {
	content: string;
	thinking: string;
	tools: Map<string, ToolExecution>;
	toolOutputs: Map<string, MessageContent>;
}

// ============================================================================
// ID Generators
// ============================================================================

function generateMessageId(): string {
	return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateToolId(): string {
	return `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useChat(): UseChatReturn {
	const store = useChatStore();
	const streamingRef = useRef<StreamingState>({
		content: "",
		thinking: "",
		tools: new Map(),
		toolOutputs: new Map(),
	});
	const handlersRef = useRef<(() => void)[]>([]);
	const [, setExpandedTools] = useState<Set<string>>(new Set());
	// Use ref for finalize function to avoid circular dependency
	const finalizeRef = useRef<() => void>();

	// Cleanup handlers on unmount
	useEffect(() => {
		return () => {
			handlersRef.current.forEach((unsubscribe) => {
				unsubscribe();
			});
			handlersRef.current = [];
		};
	}, []);

	// Clear all streaming handlers
	const clearHandlers = useCallback(() => {
		handlersRef.current.forEach((unsubscribe) => {
			unsubscribe();
		});
		handlersRef.current = [];
	}, []);

	// Register a handler and track it for cleanup
	const registerHandler = useCallback(
		<T extends ChatWebSocketMessage["type"]>(
			event: T,
			handler: (data: any) => void,
		) => {
			const unsubscribe = wsClient.on(event, handler);
			handlersRef.current.push(unsubscribe);
			return unsubscribe;
		},
		[],
	);

	// Finalize the streaming message into the message list
	const finalizeStreamingMessage = useCallback(() => {
		// 工具内容已经通过 setActiveTool 和 updateToolOutput 添加到 store 中
		// 直接调用 finishStreaming 完成流式消息
		store.finishStreaming();
	}, [store]);

	// Store finalize function in ref
	finalizeRef.current = finalizeStreamingMessage;

	// Setup streaming handlers for WebSocket events
	const setupStreamingHandlers = useCallback(() => {
		clearHandlers();
		streamingRef.current = {
			content: "",
			thinking: "",
			tools: new Map(),
			toolOutputs: new Map(),
		};

		// Content delta handler - streaming text
		registerHandler("content_delta", (data: ContentDeltaMessage) => {
			streamingRef.current.content += data.text;
			store.appendStreamingContent(data.text);
		});

		// Thinking delta handler - streaming thinking
		registerHandler("thinking_delta", (data: ThinkingDeltaMessage) => {
			streamingRef.current.thinking += data.thinking;
			store.appendStreamingThinking(data.thinking);
		});

		// Tool start handler
		registerHandler("tool_start", (data: ToolStartMessage) => {
			try {
				wsLog.debug("tool_start event received:", data);
				wsLog.debug("tool_start data type:", typeof data);

				// 确保data有必要的属性
				if (!data || typeof data !== "object") {
					wsLog.error("Invalid tool_start data:", data);
					return;
				}

				const toolCallId = data.toolCallId || generateToolId();
				const toolName = data.toolName || "unknown";
				const args = data.args || {};

				wsLog.debug("Creating tool:", { toolCallId, toolName, args });

				const tool: ToolExecution = {
					id: toolCallId,
					name: toolName,
					args: args,
					status: "executing",
					startTime: new Date(),
				};
				streamingRef.current.tools.set(tool.id, tool);
				store.setActiveTool(tool);
			} catch (error) {
				wsLog.error("Error in tool_start handler:", { error, data });
			}
		});

		// Tool update handler - partial output
		registerHandler("tool_update", (data: ToolUpdateMessage) => {
			const existing = streamingRef.current.tools.get(data.toolCallId);
			if (existing) {
				// 后端发送的是chunk字段，不是output
				if (data.chunk) {
					existing.output = (existing.output || "") + data.chunk;
					streamingRef.current.toolOutputs.set(data.toolCallId, {
						type: "tool",
						toolCallId: data.toolCallId,
						toolName: existing.name,
						args: existing.args,
						output: existing.output,
					});
					store.updateToolOutput(data.toolCallId, existing.output, undefined);
				}
				if (data.error) {
					existing.error = data.error;
					existing.status = "error";
					store.updateToolOutput(
						data.toolCallId,
						existing.output || "",
						data.error,
					);
				}
			}
		});

		// Tool end handler - tool execution complete
		registerHandler("tool_end", (data: ToolEndMessage) => {
			const existing = streamingRef.current.tools.get(data.toolCallId);
			if (existing) {
				// 后端发送的是result和isError字段，不是output和error
				const output = data.result || "";
				const error = data.isError ? "工具执行失败" : undefined;

				if (error) {
					existing.error = error;
					existing.status = "error";
					existing.endTime = new Date();
					store.updateToolOutput(data.toolCallId, existing.output || "", error);
				} else {
					existing.output = output || existing.output;
					existing.status = "success";
					existing.endTime = new Date();
					store.updateToolOutput(data.toolCallId, output, undefined);
				}
			}

			// 如果有文件内容（写文件操作），将文件内容作为流式文本追加
			if (data.fileContent && data.filePath) {
				// 添加文件头部标识
				const fileHeader = `\n\n📄 **写入文件: \`${data.filePath}\`**\n\n\`\`\`\n`;
				store.appendStreamingContent(fileHeader);
				// 添加文件内容
				store.appendStreamingContent(data.fileContent);
				// 添加代码块结束标记
				store.appendStreamingContent("\n```\n");
			}
		});

		// Agent start handler
		registerHandler("agent_start", (data: AgentStartMessage) => {
			wsLog.info("Agent started", data);
		});

		// Agent end handler - finalize streaming
		registerHandler("agent_end", (_data: AgentEndMessage) => {
			finalizeRef.current?.();
			clearHandlers();
		});

		// Message start/end handlers
		registerHandler("message_start", () => {
			wsLog.info("Message started");
		});

		registerHandler("message_end", () => {
			wsLog.info("Message ended");
		});

		// Turn start/end handlers
		registerHandler("turn_start", () => {
			wsLog.info("Turn started - starting new turn block");
			// 先将当前工具输出保存到 ref（如果需要）
			// 注意：store.startNewTurn() 已经把当前内容保存到消息中了
			store.startNewTurn();
			// 重置本地流式状态用于新一轮
			streamingRef.current.thinking = "";
			streamingRef.current.content = "";
			// 工具状态由 store 管理，这里只需要重置本地 ref
			streamingRef.current.tools = new Map();
			streamingRef.current.toolOutputs = new Map();
		});

		registerHandler("turn_end", (data) => {
			wsLog.info("Turn ended:", data);
		});

		// Compaction start/end handlers
		registerHandler("compaction_start", () => {
			wsLog.info("Compaction started");
		});

		registerHandler("compaction_end", () => {
			wsLog.info("Compaction ended");
		});

		// Retry start/end handlers
		registerHandler("retry_start", () => {
			wsLog.info("Retry started");
		});

		registerHandler("retry_end", () => {
			wsLog.info("Retry ended");
		});

		// Error handler - using generic string type for error events
		registerHandler("error" as string, (data) => {
			wsLog.error("WebSocket error:", data);
			store.abortStreaming();
			clearHandlers();
		});
	}, [store, registerHandler, clearHandlers]);

	// Check if text is a bash command
	const isBashCommand = useCallback((text: string): boolean => {
		return text.trimStart().startsWith("!");
	}, []);

	// Get slash command from text
	const getSlashCommand = useCallback((text: string): string | null => {
		const trimmed = text.trimStart();
		if (trimmed.startsWith("/")) {
			const match = trimmed.match(/^\/([a-zA-Z]+)/);
			return match ? match[1] : null;
		}
		return null;
	}, []);

	// Process input for bash/slash commands
	const processInput = useCallback(
		(text: string): { processed: string; isBash: boolean } => {
			const trimmed = text.trim();

			if (isBashCommand(trimmed)) {
				// Remove the ! prefix and treat as bash command
				return {
					processed: trimmed.slice(1).trim(),
					isBash: true,
				};
			}

			return { processed: trimmed, isBash: false };
		},
		[isBashCommand],
	);

	// Send message
	const sendMessage = useCallback(() => {
		const text = store.inputText;
		if (!text.trim()) return;

		const { processed, isBash } = processInput(text);

		// Create user message
		const userMessage: Message = {
			id: generateMessageId(),
			role: "user",
			content: [{ type: "text", text: processed }],
			timestamp: new Date(),
		};

		// Add user message to store
		store.addMessage(userMessage);
		store.clearInput();
		store.startStreaming();

		// Setup streaming handlers
		setupStreamingHandlers();

		// Send via WebSocket
		if (isBash) {
			wsClient.send({
				type: "prompt",
				text: `Execute this bash command: ${processed}`,
			});
		} else {
			wsClient.send({
				type: "prompt",
				text: processed,
			});
		}
	}, [store, processInput, setupStreamingHandlers]);

	// Abort generation
	const abortGeneration = useCallback(() => {
		wsClient.send({ type: "abort" });
		store.abortStreaming();
		clearHandlers();
	}, [store, clearHandlers]);

	// Clear all messages
	const clearMessages = useCallback(() => {
		store.clearMessages();
		streamingRef.current = {
			content: "",
			thinking: "",
			tools: new Map(),
			toolOutputs: new Map(),
		};
	}, [store]);

	// Toggle message collapse
	const toggleMessageCollapse = useCallback(
		(messageId: string) => {
			store.toggleMessageCollapse(messageId);
		},
		[store],
	);

	// Toggle thinking collapse
	const toggleThinkingCollapse = useCallback(
		(messageId: string) => {
			store.toggleThinkingCollapse(messageId);
		},
		[store],
	);

	// Set show thinking
	const setShowThinking = useCallback(
		(show: boolean) => {
			store.setShowThinking(show);
		},
		[store],
	);

	// Set input text
	const setInputText = useCallback(
		(text: string) => {
			store.setInputText(text);
		},
		[store],
	);

	// Get tool status
	const getToolStatus = useCallback(
		(toolId: string): ToolExecution | undefined => {
			return store.activeTools.get(toolId);
		},
		[store.activeTools],
	);

	// Expand tool output
	const expandToolOutput = useCallback((toolId: string) => {
		setExpandedTools((prev) => new Set([...prev, toolId]));
	}, []);

	// Collapse tool output
	const collapseToolOutput = useCallback((toolId: string) => {
		setExpandedTools((prev) => {
			const next = new Set(prev);
			next.delete(toolId);
			return next;
		});
	}, []);

	return {
		// State
		messages: store.messages,
		currentStreamingMessage: store.currentStreamingMessage,
		inputText: store.inputText,
		isStreaming: store.isStreaming,
		showThinking: store.showThinking,
		activeTools: store.activeTools,

		// Actions
		setInputText,
		sendMessage,
		abortGeneration,
		clearMessages,
		toggleMessageCollapse,
		toggleThinkingCollapse,
		setShowThinking,

		// Tool actions
		getToolStatus,
		expandToolOutput,
		collapseToolOutput,

		// Utils
		isBashCommand,
		getSlashCommand,
	};
}

// ============================================================================
// Re-export types
// ============================================================================

export type { Message, MessageContent, ToolExecution };
