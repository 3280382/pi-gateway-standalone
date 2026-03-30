/**
 * Chat Service - 处理聊天相关的业务逻辑
 */

import type { Message, ToolExecution } from "@/types/chat";
import { BaseService, ServiceError } from "./base.service";

export interface SendMessageRequest {
	text: string;
	sessionId?: string;
	model?: string;
	thinkingLevel?: "concise" | "balanced" | "detailed";
}

export interface SendMessageResponse {
	messageId: string;
	sessionId: string;
	timestamp: string;
}

export interface ChatSession {
	id: string;
	name: string;
	created: string;
	modified: string;
	messageCount: number;
	firstMessage?: string;
	workspace?: string;
}

export interface LoadSessionResponse {
	session: ChatSession;
	messages: Message[];
	currentModel: string;
	workspace: string;
}

export class ChatService {
	protected serviceName = "ChatService";
	protected basePath = "/api";

	constructor() {}

	/**
	 * 发送消息
	 */
	async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
		try {
			// 这里实际上是通过WebSocket发送，但为了API一致性提供接口
			// 实际实现会在WebSocket客户端中
			return await this.post<SendMessageResponse>("/chat/send", request);
		} catch (error) {
			if (error instanceof ServiceError) {
				throw error;
			}
			throw new ServiceError(
				"SEND_MESSAGE_FAILED",
				"Failed to send message",
				error,
			);
		}
	}

	/**
	 * 加载会话
	 */
	async loadSession(sessionId: string): Promise<LoadSessionResponse> {
		try {
			return await this.post<LoadSessionResponse>("/session/load", {
				sessionId,
			});
		} catch (error) {
			throw new ServiceError(
				"LOAD_SESSION_FAILED",
				"Failed to load session",
				error,
			);
		}
	}

	/**
	 * 保存会话
	 */
	async saveSession(sessionId: string, messages: Message[]): Promise<void> {
		try {
			await this.post("/session/save", { sessionId, messages });
		} catch (error) {
			throw new ServiceError(
				"SAVE_SESSION_FAILED",
				"Failed to save session",
				error,
			);
		}
	}

	/**
	 * 获取会话列表
	 */
	async listSessions(workspace?: string): Promise<ChatSession[]> {
		try {
			const params = workspace ? { workspace } : {};
			const response = await this.get<{ sessions: ChatSession[] }>(
				"/sessions",
				params,
			);
			return response.sessions;
		} catch (error) {
			throw new ServiceError(
				"LIST_SESSIONS_FAILED",
				"Failed to list sessions",
				error,
			);
		}
	}

	/**
	 * 创建新会话
	 */
	async createSession(name: string, workspace?: string): Promise<ChatSession> {
		try {
			return await this.post<ChatSession>("/session/create", {
				name,
				workspace,
			});
		} catch (error) {
			throw new ServiceError(
				"CREATE_SESSION_FAILED",
				"Failed to create session",
				error,
			);
		}
	}

	/**
	 * 删除会话
	 */
	async deleteSession(sessionId: string): Promise<void> {
		try {
			await this.post("/session/delete", { sessionId });
		} catch (error) {
			throw new ServiceError(
				"DELETE_SESSION_FAILED",
				"Failed to delete session",
				error,
			);
		}
	}

	/**
	 * 获取可用模型列表
	 */
	async getAvailableModels(): Promise<
		Array<{ id: string; name: string; provider: string; description: string }>
	> {
		try {
			const response = await this.get<{ models: any[] }>("/models");
			return response.models;
		} catch (error) {
			throw new ServiceError(
				"GET_MODELS_FAILED",
				"Failed to get models",
				error,
			);
		}
	}

	/**
	 * 设置当前模型
	 */
	async setCurrentModel(modelId: string): Promise<void> {
		try {
			await this.post("/model/set", { modelId });
		} catch (error) {
			throw new ServiceError("SET_MODEL_FAILED", "Failed to set model", error);
		}
	}

	/**
	 * 获取系统提示
	 */
	async getSystemPrompt(): Promise<string> {
		try {
			const response = await this.get<{ prompt: string }>("/system-prompt");
			return response.prompt;
		} catch (error) {
			throw new ServiceError(
				"GET_SYSTEM_PROMPT_FAILED",
				"Failed to get system prompt",
				error,
			);
		}
	}

	/**
	 * 更新系统提示
	 */
	async updateSystemPrompt(prompt: string): Promise<void> {
		try {
			await this.post("/system-prompt/update", { prompt });
		} catch (error) {
			throw new ServiceError(
				"UPDATE_SYSTEM_PROMPT_FAILED",
				"Failed to update system prompt",
				error,
			);
		}
	}

	/**
	 * 清除聊天历史
	 */
	async clearChatHistory(sessionId: string): Promise<void> {
		try {
			await this.post("/chat/clear", { sessionId });
		} catch (error) {
			throw new ServiceError(
				"CLEAR_CHAT_FAILED",
				"Failed to clear chat history",
				error,
			);
		}
	}

	/**
	 * 重新生成消息
	 */
	async regenerateMessage(messageId: string): Promise<void> {
		try {
			await this.post("/message/regenerate", { messageId });
		} catch (error) {
			throw new ServiceError(
				"REGENERATE_MESSAGE_FAILED",
				"Failed to regenerate message",
				error,
			);
		}
	}

	/**
	 * 工具执行完成回调
	 */
	async onToolComplete(
		toolId: string,
		output: any,
		error?: string,
	): Promise<void> {
		try {
			await this.post("/tool/complete", { toolId, output, error });
		} catch (error) {
			throw new ServiceError(
				"TOOL_COMPLETE_FAILED",
				"Failed to complete tool execution",
				error,
			);
		}
	}

	/**
	 * 中止生成
	 */
	async abortGeneration(): Promise<void> {
		try {
			await this.post("/generation/abort", {});
		} catch (error) {
			throw new ServiceError(
				"ABORT_GENERATION_FAILED",
				"Failed to abort generation",
				error,
			);
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
			const response = await this.post<{ messages: Message[] }>(
				"/chat/search",
				{
					query,
					filters,
				},
			);
			return response.messages;
		} catch (error) {
			throw new ServiceError(
				"SEARCH_MESSAGES_FAILED",
				"Failed to search messages",
				error,
			);
		}
	}
}

// 导出单例
export const chatService = new ChatService();
