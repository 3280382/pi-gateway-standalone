/**
 * Enhanced Chat API - 完整整合所有WebSocket功能
 * 连接Zustand Store与后端WebSocket，实现所有后端支持的功能
 */

import { useChatStore } from "@/features/chat/stores/chatStore";
import type {
	ChatController,
	Message,
	ToolExecution,
} from "@/features/chat/types/chat";
import { websocketService } from "@/shared/services/websocket.service";
import { useSessionStore } from "@/shared/stores/sessionStore";

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

	// 注意：全局流式处理器由 setupWebSocketListeners() 统一设置
	// 在应用初始化时调用一次，这里不再重复设置，避免消息重复处理

	return {
		// 基础聊天功能（支持图片）
		sendMessage: async (
			text: string,
			images?: Array<{
				type: "image";
				source: { type: "base64"; mediaType: string; data: string };
			}>,
		) => {
			if (!text.trim() && (!images || images.length === 0))
				return Promise.resolve();

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

			// 构建消息内容（文本 + 图片）
			const content: Message["content"] = [{ type: "text", text }];
			if (images && images.length > 0) {
				content.push(
					...images.map((img) => ({
						type: "image" as const,
						imageUrl: `data:${img.source.mediaType};base64,${img.source.data}`,
					})),
				);
			}

			// 添加用户消息
			const userMessage: Message = {
				id: generateMessageId(),
				role: "user",
				content,
				timestamp: new Date(),
			};

			chatStore.addMessage(userMessage);
			chatStore.clearInput();
			chatStore.startStreaming();

			// 通过WebSocket发送消息
			const success = websocketService.send("prompt", { text, images });

			if (!success) {
				chatStore.abortStreaming();
				throw new Error("消息发送失败，请重试");
			}
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

		toggleToolsCollapse: (messageId: string) => {
			chatStore.toggleToolsCollapse(messageId);
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
					sessionStore.setCurrentModel(modelId);
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
					sessionStore.setCurrentDir(data.cwd);
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
// Streaming Handlers Setup - 全局WebSocket监听器设置
// ============================================================================

let handlersSetup = false;

/**
 * 设置全局WebSocket流式处理器
 * 
 * 【架构设计说明】
 * 这是全局事件处理器，在应用初始化时调用一次（见 useAppInitialization.ts）。
 * 
 * 【为什么 Service 直接操作 Store？】
 * 1. WebSocket 事件是"被动接收"，不是用户操作，不经过 UI 层
 * 2. 全局订阅必须在组件挂载前完成，避免初始消息丢失
 * 3. 放在 Hook 中会导致：组件卸载时事件处理中断、多个组件重复订阅
 * 4. 这是 WebSocket 类服务的特殊处理模式，非通用做法
 * 
 * 【正常数据流 vs WebSocket 事件流】
 * 正常数据流: UI → Hook → Service → Store
 * WebSocket事件: Service → (全局处理器) → Store → UI
 * 
 * 【约定】
 * 只有 setupWebSocketListeners 可以直接操作 Store。
 * 其他 Service 代码必须通过 Hook 或 Controller 间接操作 Store。
 * 
 * @example
 * // App 初始化时调用一次
 * setupWebSocketListeners();
 */
export function setupWebSocketListeners(): void {
	// 防止重复设置
	if (handlersSetup) return;
	handlersSetup = true;

	const store = useChatStore.getState();

	// 只设置一次全局监听器
	// Content delta handler - handles streaming text
	websocketService.on(
		"content_delta",
		(data: { text?: string; delta?: string }) => {
			const ts = new Date().toISOString().split("T")[1].split(".")[0];
			console.log(`[${ts}] [RECV] content_delta`);
			const content = data?.text || data?.delta;
			if (content) {
				store.appendStreamingContent(content);
			}
		},
	);

	// Thinking delta handler
	websocketService.on(
		"thinking_delta",
		(data: { thinking?: string; delta?: string }) => {
			const ts = new Date().toISOString().split("T")[1].split(".")[0];
			console.log(`[${ts}] [RECV] thinking_delta`);
			const content = data?.thinking || data?.delta;
			if (content) {
				store.appendStreamingThinking(content);
			}
		},
	);

	// Tool call delta handler
	websocketService.on("toolcall_delta", (data: any) => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(
			`[${ts}] [RECV] toolcall_delta: ${data?.toolName || "unknown"}`,
		);
		try {
			if (data?.toolCallId && data?.toolName) {
				store.appendToolCallDelta(
					data.toolCallId,
					data.toolName,
					data.delta || "",
				);
			}
		} catch (error) {
			console.error(
				"[setupWebSocketListeners] Error in toolcall_delta handler:",
				error,
			);
		}
	});

	// Tool start handler
	websocketService.on(
		"tool_start",
		(data: { toolCallId?: string; toolName: string; args?: any }) => {
			const ts = new Date().toISOString().split("T")[1].split(".")[0];
			console.log(`[${ts}] [RECV] tool_start: ${data?.toolName || "unknown"}`);
			try {
				if (!data || typeof data !== "object") {
					console.error(
						"[setupWebSocketListeners] Invalid tool_start data:",
						data,
					);
					return;
				}
				const toolCallId = data.toolCallId || generateToolId();
				const toolName = data.toolName || "unknown";
				const args = data.args || {};
				const tool: ToolExecution = {
					id: toolCallId,
					name: toolName,
					args: args,
					status: "executing",
					startTime: new Date(),
				};
				store.setActiveTool(tool);
			} catch (error) {
				console.error(
					"[setupWebSocketListeners] Error in tool_start handler:",
					error,
					"data:",
					data,
				);
			}
		},
	);

	// Tool update handler
	websocketService.on(
		"tool_update",
		(data: { toolCallId: string; chunk?: string; output?: string }) => {
			const ts = new Date().toISOString().split("T")[1].split(".")[0];
			console.log(`[${ts}] [RECV] tool_update: ${data?.toolCallId}`);
			try {
				const content = data.chunk || data.output;
				if (content) {
					store.updateToolOutput(data.toolCallId, content, undefined);
				}
			} catch (error) {
				console.error(
					"[setupWebSocketListeners] Error in tool_update handler:",
					error,
				);
			}
		},
	);

	// Tool end handler
	websocketService.on(
		"tool_end",
		(data: {
			toolCallId: string;
			result?: string;
			isError?: boolean;
			error?: string;
		}) => {
			const ts = new Date().toISOString().split("T")[1].split(".")[0];
			console.log(`[${ts}] [RECV] tool_end: ${data?.toolCallId}`);
			try {
				const output = data.result || "";
				const error = data.isError ? "工具执行失败" : undefined;
				store.updateToolOutput(data.toolCallId, output, error);
			} catch (error) {
				console.error(
					"[setupWebSocketListeners] Error in tool_end handler:",
					error,
				);
			}
		},
	);

	// Agent end handler
	websocketService.on("agent_end", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] agent_end`);
		store.finishStreaming();
	});

	// Message start/end handlers
	websocketService.on("message_start", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] message_start`);
	});

	websocketService.on("message_end", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] message_end`);
	});

	// Turn start/end handlers
	websocketService.on("turn_start", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] turn_start`);
		store.startNewTurn();
	});

	websocketService.on("turn_end", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] turn_end`);
	});

	// Compaction start/end handlers
	websocketService.on("compaction_start", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] compaction_start`);
	});

	websocketService.on("compaction_end", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] compaction_end`);
	});

	// Retry start/end handlers
	websocketService.on("retry_start", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] retry_start`);
	});

	websocketService.on("retry_end", () => {
		const ts = new Date().toISOString().split("T")[1].split(".")[0];
		console.log(`[${ts}] [RECV] retry_end`);
	});

	// Connection status handlers
	websocketService.on("connected", () => {
		console.log("[setupWebSocketListeners] WebSocket connected");
	});

	websocketService.on("disconnected", () => {
		console.log("[setupWebSocketListeners] WebSocket disconnected");
		// 如果正在流式生成，中止
		if (store.isStreaming) {
			store.abortStreaming();
		}
	});

	// Agent end handler - 已在 setupWebSocketListeners 中处理
	// Error handler - 由全局WebSocket服务统一处理
}

// ============================================================================
// Legacy API exports (for backward compatibility)
// ============================================================================

// wsClient 已废弃，请直接使用 websocketService
// createChatController 已废弃，请使用 useChatController hook
