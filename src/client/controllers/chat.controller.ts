/**
 * Chat Controller - 连接Service层和Store层
 * 处理聊天相关的业务逻辑
 */

import { ServiceError } from "@/services/base.service";
import { chatService } from "@/services/chat.service";
import { websocketService } from "@/services/websocket.service";
import { useNewChatStore } from "@/stores/new-chat.store";
import type { Message, ToolExecution } from "@/types/chat";

export class ChatController {
	private store = useNewChatStore;

	/**
	 * 发送消息
	 */
	async sendMessage(text: string): Promise<void> {
		try {
			const state = this.store.getState();

			// 创建用户消息
			const userMessage: Message = {
				id: this.generateMessageId(),
				role: "user",
				content: [{ type: "text", text }],
				timestamp: new Date(),
			};

			// 添加到store
			this.store.getState().addMessage(userMessage);
			this.store.getState().clearInput();

			// 创建流式消息
			const streamingMessage: Message = {
				id: this.generateMessageId(),
				role: "assistant",
				content: [],
				timestamp: new Date(),
				isStreaming: true,
			};

			this.store.getState().setCurrentStreamingMessage(streamingMessage);
			this.store.getState().setStreaming(true);

			// 通过WebSocket发送消息
			const success = websocketService.sendMessage(text, state.sessionId, state.currentModel);

			if (!success) {
				throw new ServiceError("WEBSOCKET_SEND_FAILED", "Failed to send message via WebSocket");
			}

			// 监听WebSocket事件
			this.setupWebSocketListeners();
		} catch (error) {
			this.handleError("sendMessage", error);
			throw error;
		}
	}

	/**
	 * 中止生成
	 */
	async abortGeneration(): Promise<void> {
		try {
			websocketService.abortGeneration();
			this.store.getState().resetStreaming();
		} catch (error) {
			this.handleError("abortGeneration", error);
		}
	}

	/**
	 * 加载会话
	 */
	async loadSession(sessionId: string): Promise<void> {
		try {
			const response = await chatService.loadSession(sessionId);

			// 更新store
			this.store.getState().setMessages(response.messages);
			this.store.getState().setSessionId(sessionId);
			this.store.getState().setCurrentModel(response.currentModel);

			// 发送WebSocket消息切换会话
			websocketService.switchSession(sessionId, response.workspace);
		} catch (error) {
			this.handleError("loadSession", error);
			throw error;
		}
	}

	/**
	 * 保存当前会话
	 */
	async saveCurrentSession(): Promise<void> {
		try {
			const state = this.store.getState();

			if (!state.sessionId) {
				throw new ServiceError("NO_SESSION_ID", "No session ID available");
			}

			await chatService.saveSession(state.sessionId, state.messages);
		} catch (error) {
			this.handleError("saveCurrentSession", error);
			throw error;
		}
	}

	/**
	 * 创建新会话
	 */
	async createSession(name: string, workspace?: string): Promise<string> {
		try {
			const session = await chatService.createSession(name, workspace);

			// 更新store
			this.store.getState().reset();
			this.store.getState().setSessionId(session.id);

			// 发送WebSocket消息切换会话
			websocketService.switchSession(session.id, workspace);

			return session.id;
		} catch (error) {
			this.handleError("createSession", error);
			throw error;
		}
	}

	/**
	 * 删除会话
	 */
	async deleteSession(sessionId: string): Promise<void> {
		try {
			await chatService.deleteSession(sessionId);

			// 如果删除的是当前会话，重置store
			const state = this.store.getState();
			if (state.sessionId === sessionId) {
				this.store.getState().reset();
			}
		} catch (error) {
			this.handleError("deleteSession", error);
			throw error;
		}
	}

	/**
	 * 获取可用模型列表
	 */
	async getAvailableModels(): Promise<Array<{ id: string; name: string; provider: string; description: string }>> {
		try {
			return await chatService.getAvailableModels();
		} catch (error) {
			this.handleError("getAvailableModels", error);
			throw error;
		}
	}

	/**
	 * 设置当前模型
	 */
	async setCurrentModel(modelId: string): Promise<void> {
		try {
			await chatService.setCurrentModel(modelId);
			this.store.getState().setCurrentModel(modelId);
		} catch (error) {
			this.handleError("setCurrentModel", error);
			throw error;
		}
	}

	/**
	 * 获取系统提示
	 */
	async getSystemPrompt(): Promise<string> {
		try {
			return await chatService.getSystemPrompt();
		} catch (error) {
			this.handleError("getSystemPrompt", error);
			throw error;
		}
	}

	/**
	 * 更新系统提示
	 */
	async updateSystemPrompt(prompt: string): Promise<void> {
		try {
			await chatService.updateSystemPrompt(prompt);
		} catch (error) {
			this.handleError("updateSystemPrompt", error);
			throw error;
		}
	}

	/**
	 * 清除聊天历史
	 */
	async clearChatHistory(): Promise<void> {
		try {
			const state = this.store.getState();

			if (state.sessionId) {
				await chatService.clearChatHistory(state.sessionId);
			}

			this.store.getState().clearMessages();
		} catch (error) {
			this.handleError("clearChatHistory", error);
			throw error;
		}
	}

	/**
	 * 重新生成消息
	 */
	async regenerateMessage(messageId: string): Promise<void> {
		try {
			await chatService.regenerateMessage(messageId);

			// 从store中移除该消息及之后的所有消息
			const state = this.store.getState();
			const messageIndex = state.messages.findIndex((m) => m.id === messageId);

			if (messageIndex !== -1) {
				const newMessages = state.messages.slice(0, messageIndex);
				this.store.getState().setMessages(newMessages);

				// 重新发送用户消息
				const message = state.messages[messageIndex];
				if (message && message.role === "user") {
					const text = message.content.find((c) => c.type === "text")?.text || "";
					if (text) {
						await this.sendMessage(text);
					}
				}
			}
		} catch (error) {
			this.handleError("regenerateMessage", error);
			throw error;
		}
	}

	/**
	 * 搜索聊天记录
	 */
	async searchMessages(
		query: string,
		filters?: {
			sessionId?: string;
			startDate?: string;
			endDate?: string;
			limit?: number;
		},
	): Promise<Message[]> {
		try {
			const results = await chatService.searchMessages(query, filters);

			// 更新store中的搜索结果
			const resultIds = results.map((m) => m.id);
			this.store.getState().setSearchResults(resultIds);
			this.store.getState().setSearching(false);

			return results;
		} catch (error) {
			this.store.getState().setSearching(false);
			this.handleError("searchMessages", error);
			throw error;
		}
	}

	/**
	 * 初始化WebSocket连接
	 */
	async initWebSocketConnection(): Promise<void> {
		try {
			await websocketService.connect();
			this.setupWebSocketListeners();
		} catch (error) {
			this.handleError("initWebSocketConnection", error);
			throw error;
		}
	}

	/**
	 * 断开WebSocket连接
	 */
	disconnectWebSocket(): void {
		websocketService.disconnect();
	}

	/**
	 * 设置WebSocket监听器
	 */
	private setupWebSocketListeners(): void {
		// 移除现有的监听器（避免重复添加）
		// 实际实现中需要更完善的监听器管理

		// 内容增量
		websocketService.on("content_delta", (data) => {
			this.store.getState().appendStreamingContent(data.text);
		});

		// 思考增量
		websocketService.on("thinking_delta", (data) => {
			this.store.getState().appendStreamingThinking(data.thinking);
		});

		// 工具开始
		websocketService.on("tool_start", (data) => {
			const tool: ToolExecution = {
				id: data.toolCallId,
				name: data.toolName,
				args: data.args || {},
				status: "executing",
				startTime: new Date(),
			};

			this.store.getState().setActiveTool(data.toolCallId, tool);
		});

		// 工具更新
		websocketService.on("tool_update", (data) => {
			const updates: Partial<ToolExecution> = {};

			if (data.output !== undefined) {
				updates.output = data.output;
			}

			if (data.error !== undefined) {
				updates.error = data.error;
				updates.status = "error";
			}

			this.store.getState().updateActiveTool(data.toolCallId, updates);
		});

		// 工具结束
		websocketService.on("tool_end", (data) => {
			const updates: Partial<ToolExecution> = {
				status: data.error ? "error" : "success",
				endTime: new Date(),
			};

			if (data.output !== undefined) {
				updates.output = data.output;
			}

			if (data.error !== undefined) {
				updates.error = data.error;
			}

			this.store.getState().updateActiveTool(data.toolCallId, updates);
		});

		// 代理结束
		websocketService.on("agent_end", () => {
			this.finalizeStreamingMessage();
		});

		// 连接状态变化
		websocketService.on("connected", () => {
			console.log("[ChatController] WebSocket connected");
		});

		websocketService.on("disconnected", () => {
			console.log("[ChatController] WebSocket disconnected");
			// 如果正在流式生成，中止
			if (this.store.getState().isStreaming) {
				this.store.getState().resetStreaming();
			}
		});
	}

	/**
	 * 完成流式消息
	 */
	private finalizeStreamingMessage(): void {
		const state = this.store.getState();

		if (!state.currentStreamingMessage) return;

		const content = [];

		// 添加思考内容
		if (state.streamingThinking) {
			content.push({
				type: "thinking",
				thinking: state.streamingThinking,
			});
		}

		// 添加文本内容
		if (state.streamingContent) {
			content.push({
				type: "text",
				text: state.streamingContent,
			});
		}

		// 添加工具内容
		const tools = Array.from(state.activeTools.values());
		tools.forEach((tool) => {
			content.push({
				type: "tool",
				toolCallId: tool.id,
				toolName: tool.name,
				args: tool.args,
				output: tool.output,
				error: tool.error,
			});
		});

		// 更新消息
		const finalMessage: Message = {
			...state.currentStreamingMessage,
			content,
			isStreaming: false,
		};

		this.store.getState().addMessage(finalMessage);
		this.store.getState().resetStreaming();
		this.store.getState().clearActiveTools();
	}

	/**
	 * 生成消息ID
	 */
	private generateMessageId(): string {
		return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * 处理错误
	 */
	private handleError(method: string, error: any): void {
		console.error(`[ChatController.${method}] Error:`, error);

		// 更新store错误状态
		// 这里可以添加更详细的错误处理逻辑

		// 如果是流式生成错误，重置状态
		if (method === "sendMessage" && this.store.getState().isStreaming) {
			this.store.getState().resetStreaming();
		}
	}
}

// 导出单例
export const chatController = new ChatController();
