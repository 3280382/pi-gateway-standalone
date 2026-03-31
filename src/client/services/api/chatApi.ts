/**
 * Enhanced Chat API - 完整整合所有WebSocket功能
 * 连接Zustand Store与后端WebSocket，实现所有后端支持的功能
 */

import { websocketService } from "@/services/websocket.service";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { ChatController, Message, ToolExecution } from "@/types/chat";

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
// Enhanced Chat Controller Interface (扩展原有接口)
// ============================================================================

export interface EnhancedChatController extends ChatController {
	// 扩展功能
	steer: (text: string) => void;
	createNewSession: () => Promise<void>;
	loadSession: (sessionPath: string) => Promise<void>;
	listSessions: (cwd: string) => Promise<any>;
	setModel: (
		provider: string,
		modelId: string,
		thinkingLevel?: string,
	) => Promise<void>;
	listModels: () => Promise<any>;
	executeCommand: (command: string) => Promise<any>;
	setLlmLogEnabled: (enabled: boolean) => Promise<void>;
	changeWorkingDir: (path: string) => Promise<void>;
}

// ============================================================================
// Controller Hook
// ============================================================================

export function useChatController(): EnhancedChatController {
	const chatStore = useChatStore();
	const sessionStore = useSessionStore();

	return {
		// 基础聊天功能
		sendMessage: async (text: string) => {
			if (!text.trim()) return Promise.resolve();

			// 检查WebSocket连接状态
			if (!websocketService.isConnected) {
				console.error(
					"[ChatAPI] WebSocket not connected, attempting to connect...",
				);
				try {
					await websocketService.connect();
				} catch (error) {
					console.error("[ChatAPI] Failed to connect WebSocket:", error);
					throw new Error("无法连接到服务器，请检查网络连接");
				}
			}

			// 添加用户消息
			const userMessage: Message = {
				id: generateMessageId(),
				role: "user",
				content: [{ type: "text", text }],
				timestamp: new Date(),
			};

			chatStore.addMessage(userMessage);
			chatStore.clearInput();
			chatStore.startStreaming();

			// 通过WebSocket发送消息
			const success = websocketService.send("prompt", { text });

			if (!success) {
				chatStore.abortStreaming();
				throw new Error("消息发送失败，请重试");
			}

			// 设置消息处理器用于流式响应
			setupStreamingHandlers(chatStore);
		},

		abortGeneration: () => {
			websocketService.send("abort", {});
			chatStore.abortStreaming();
		},

		steer: (text: string) => {
			if (!text.trim()) return;
			websocketService.steer(text);
		},

		// 输入控制
		setInputText: (text: string) => {
			chatStore.setInputText(text);
		},

		clearInput: () => {
			chatStore.clearInput();
		},

		// 消息操作
		toggleMessageCollapse: (messageId: string) => {
			chatStore.toggleMessageCollapse(messageId);
		},

		toggleThinkingCollapse: (messageId: string) => {
			chatStore.toggleThinkingCollapse(messageId);
		},

		deleteMessage: (messageId: string) => {
			chatStore.deleteMessage(messageId);
		},

		clearMessages: () => {
			chatStore.clearMessages();
		},

		regenerateMessage: (messageId: string) => {
			chatStore.regenerateMessage(messageId);
		},

		// 思考显示
		setShowThinking: (show: boolean) => {
			chatStore.setShowThinking(show);
		},

		// 工具操作（占位符实现）
		expandToolOutput: (_toolId: string) => {
			// 工具输出展开在组件状态中处理
		},

		collapseToolOutput: (_toolId: string) => {
			// 工具输出折叠在组件状态中处理
		},

		// 会话管理
		createNewSession: async () => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("创建新会话超时"));
				}, 5000);

				const unsubscribe = websocketService.on("session_created", (data) => {
					clearTimeout(timeout);
					chatStore.clearMessages();
					chatStore.setSessionId(data.sessionId);
					unsubscribe();
					resolve();
				});

				websocketService.send("new_session");
			});
		},

		loadSession: async (sessionPath: string) => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("加载会话超时"));
				}, 5000);

				const unsubscribe = websocketService.on("session_loaded", (data) => {
					clearTimeout(timeout);
					if (data.success) {
						chatStore.setSessionId(data.sessionId);
						// 加载会话消息
						chatStore
							.loadSession(sessionPath)
							.then(() => {
								unsubscribe();
								resolve();
							})
							.catch(reject);
					} else {
						unsubscribe();
						reject(new Error(data.error || "加载会话失败"));
					}
				});

				websocketService.send("load_session", { sessionPath });
			});
		},

		listSessions: async (cwd: string) => {
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("列出会话超时"));
				}, 5000);

				const unsubscribe = websocketService.on("sessions_list", (data) => {
					clearTimeout(timeout);
					unsubscribe();
					resolve(data);
				});

				websocketService.listSessions(cwd);
			});
		},

		// 模型管理
		setModel: async (
			provider: string,
			modelId: string,
			thinkingLevel?: string,
		) => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("设置模型超时"));
				}, 5000);

				const unsubscribe = websocketService.on("model_set", (data) => {
					clearTimeout(timeout);
					sessionStore.getState().setCurrentModel(modelId);
					unsubscribe();
					resolve();
				});

				websocketService.setModel(provider, modelId, thinkingLevel);
			});
		},

		listModels: async () => {
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("列出模型超时"));
				}, 5000);

				const unsubscribe = websocketService.on("models_list", (data) => {
					clearTimeout(timeout);
					unsubscribe();
					resolve(data);
				});

				websocketService.listModels();
			});
		},

		// 系统命令
		executeCommand: async (command: string) => {
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("执行命令超时"));
				}, 5000);

				const unsubscribe = websocketService.on("command_result", (data) => {
					clearTimeout(timeout);
					unsubscribe();
					resolve(data);
				});

				websocketService.executeCommand(command);
			});
		},

		// LLM日志
		setLlmLogEnabled: async (enabled: boolean) => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("设置LLM日志超时"));
				}, 5000);

				const unsubscribe = websocketService.on("llm_log_set", (data) => {
					clearTimeout(timeout);
					unsubscribe();
					resolve();
				});

				websocketService.setLlmLogEnabled(enabled);
			});
		},

		// 工作目录
		changeWorkingDir: async (path: string) => {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("更改工作目录超时"));
				}, 5000);

				const unsubscribe = websocketService.on("dir_changed", (data) => {
					clearTimeout(timeout);
					sessionStore.getState().setCurrentDir(data.cwd);
					chatStore.setSessionId(data.sessionId);
					unsubscribe();
					resolve();
				});

				websocketService.send("change_dir", { path });
			});
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

	// Content delta handler - handles streaming text
	const contentHandler = websocketService.on(
		"content_delta",
		(data: { delta?: string }) => {
			if (data?.delta) {
				store.appendStreamingContent(data.delta);
			}
		},
	);
	handlers.push(contentHandler);

	// Thinking delta handler - handles thinking content
	const thinkingHandler = websocketService.on(
		"thinking_delta",
		(data: { delta?: string }) => {
			if (data?.delta) {
				store.appendStreamingThinking(data.delta);
			}
		},
	);
	handlers.push(thinkingHandler);

	// Tool call delta handler - handles tool call streaming
	const toolCallHandler = websocketService.on(
		"toolcall_delta",
		(data: unknown) => {
			console.log("[ChatController] Tool call delta:", data);
		},
	);
	handlers.push(toolCallHandler);

	// Tool start handler - when a tool execution starts
	const toolStartHandler = websocketService.on(
		"tool_start",
		(data: {
			toolCallId?: string;
			toolName: string;
			args?: Record<string, unknown>;
		}) => {
			console.log("[ChatController] Tool start:", data);
			const tool: ToolExecution = {
				id: data.toolCallId || generateToolId(),
				name: data.toolName,
				args: data.args || {},
				status: "executing",
				startTime: new Date(),
			};
			store.setActiveTool(tool);
		},
	);
	handlers.push(toolStartHandler);

	// Tool update handler - when tool produces output
	const toolUpdateHandler = websocketService.on(
		"tool_update",
		(data: { toolCallId: string; output?: string }) => {
			console.log("[ChatController] Tool update:", data);
			if (data.output) {
				store.updateToolOutput(data.toolCallId, data.output);
			}
		},
	);
	handlers.push(toolUpdateHandler);

	// Tool end handler - when tool execution completes
	const toolEndHandler = websocketService.on(
		"tool_end",
		(data: { toolCallId: string; result?: string; error?: string }) => {
			console.log("[ChatController] Tool end:", data);
			if (data.error) {
				store.updateToolOutput(data.toolCallId, "", data.error);
			} else {
				store.updateToolOutput(data.toolCallId, data.result || "");
			}
		},
	);
	handlers.push(toolEndHandler);

	// Agent end handler - finalize streaming
	const agentEndHandler = websocketService.on("agent_end", () => {
		console.log("[ChatController] Agent end");
		store.finishStreaming();

		// Clean up all handlers
		for (const unsubscribe of handlers) {
			unsubscribe();
		}
	});
	handlers.push(agentEndHandler);

	// Error handler
	const errorHandler = websocketService.on("error", (data: unknown) => {
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

			websocketService.send("prompt", { text });
			setupStreamingHandlers(store);
		},

		abortGeneration: () => {
			websocketService.send("abort", {});
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

// ============================================================================
// Legacy WebSocket Client for backward compatibility
// ============================================================================

export const wsClient = {
	send: (message: { type: string; text?: string }) => {
		if (message.type === "prompt") {
			websocketService.send("prompt", { text: message.text });
		} else if (message.type === "abort") {
			websocketService.send("abort", {});
		}
	},
	on: (event: string, handler: (data: any) => void) => {
		// Map legacy event names to new event names
		const eventMap: Record<string, string> = {
			content: "content_delta",
			thinking: "thinking_delta",
			toolcall_delta: "toolcall_delta",
			tool_start: "tool_start",
			tool_update: "tool_update",
			tool_end: "tool_end",
			agent_start: "agent_start",
			agent_end: "agent_end",
			error: "error",
		};
		const mappedEvent = eventMap[event] || event;
		return websocketService.on(mappedEvent as any, handler);
	},
};
