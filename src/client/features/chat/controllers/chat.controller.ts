/**
 * Chat Controller - 连接Service层和Store层
 * 处理聊天相关的业务逻辑
 */

import type { ImageUpload } from "@/features/chat/components/InputArea";
import { chatService } from "@/features/chat/services/chat.service";
import { useChatStore } from "@/features/chat/stores/chatStore";
import type { Message, ToolExecution } from "@/features/chat/types/chat";
import { ServiceError } from "@/shared/services/base.service";
import { websocketService } from "@/shared/services/websocket.service";

export class ChatController {
	private store = useChatStore;
	private listenersSetup = false;


	/**
	 * 发送消息（支持图片）
	 */
	sendMessage = async (text: string, images?: ImageUpload[]): Promise<void> => {
		try {
			// 检查WebSocket连接状态
			if (!websocketService.isConnected) {
				console.warn(
					"[ChatController] WebSocket not connected, attempting to connect...",
				);
				try {
					await websocketService.connect();
				} catch (error) {
					console.error("[ChatController] Failed to connect WebSocket:", error);
					throw new ServiceError(
						"WEBSOCKET_NOT_CONNECTED",
						"无法连接到服务器，请检查网络连接",
					);
				}
			}

			const state = this.store.getState();

			// 构建消息内容（文本 + 图片）
			const content: Message["content"] = [{ type: "text", text }];

			// 添加图片
			if (images && images.length > 0) {
				for (const img of images) {
					content.push({
						type: "image",
						imageUrl: img.preview,
					});
				}

				// 添加OCR文本作为上下文
				const ocrTexts = images
					.filter((img) => img.ocrText)
					.map((img) => `[Image OCR]: ${img.ocrText}`)
					.join("\n");

				if (ocrTexts) {
					content.push({ type: "text", text: `\n${ocrTexts}` });
				}
			}

			// 创建用户消息
			const userMessage: Message = {
				id: this.generateMessageId(),
				role: "user",
				content,
				timestamp: new Date(),
			};

			// 添加到store
			this.store.getState().addMessage(userMessage);
			this.store.getState().clearInput();

			// 开始流式传输（这会创建流式消息）
			this.store.getState().startStreaming();

			// 准备发送的图片数据
			const imageData = images?.map((img) => ({
				type: "image" as const,
				source: {
					type: "base64" as const,
					mediaType: img.mimeType,
					data: img.base64,
				},
			}));

			// 通过WebSocket发送消息（带图片）
			const success = websocketService.sendMessage(
				text,
				state.sessionId,
				state.currentModel,
				imageData,
			);

			if (!success) {
				this.store.getState().abortStreaming();
				throw new ServiceError("WEBSOCKET_SEND_FAILED", "消息发送失败，请重试");
			}
		} catch (error) {
			this.handleError("sendMessage", error);
			throw error;
		}
	};

	/**
	 * 中止生成
	 */
	abortGeneration = async (): Promise<void> => {
		try {
			websocketService.abortGeneration();
			this.store.getState().abortStreaming();
		} catch (error) {
			this.handleError("abortGeneration", error);
		}
	};

	/**
	 * 设置输入文本
	 */
	setInputText = (text: string): void => {
		this.store.getState().setInputText(text);
	};

	/**
	 * 清空输入
	 */
	clearInput = (): void => {
		this.store.getState().clearInput();
	};

	/**
	 * 切换消息折叠状态
	 */
	toggleMessageCollapse = (messageId: string): void => {
		this.store.getState().toggleMessageCollapse(messageId);
	};

	/**
	 * 切换思考内容折叠状态
	 */
	toggleThinkingCollapse = (messageId: string): void => {
		this.store.getState().toggleThinkingCollapse(messageId);
	};

	/**
	 * 切换工具折叠状态
	 */
	toggleToolsCollapse = (messageId: string): void => {
		this.store.getState().toggleToolsCollapse(messageId);
	};

	/**
	 * 删除消息
	 */
	deleteMessage = (messageId: string): void => {
		this.store.getState().deleteMessage(messageId);
	};

	/**
	 * 重新生成消息
	 */
	regenerateMessage = (messageId: string): void => {
		this.store.getState().regenerateMessage(messageId);
	};

	/**
	 * 清空所有消息
	 */
	clearMessages = (): void => {
		this.store.getState().clearMessages();
	};

	/**
	 * 加载会话
	 */
	async loadSession(sessionId: string): Promise<void> {
		try {
			// 使用WebSocket加载会话
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("加载会话超时"));
				}, 5000);

				const unsubscribe = websocketService.on("session_loaded", (data) => {
					clearTimeout(timeout);
					if (data.success) {
						this.store.getState().setSessionId(data.sessionId);
						// 加载会话消息
						this.store
							.getState()
							.loadSession(sessionId)
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

				websocketService.send("load_session", { sessionPath: sessionId });
			});
		} catch (error) {
			this.handleError("loadSession", error);
			throw error;
		}
	}

	/**
	 * 保存当前会话
	 * 注意：会话在服务器端自动保存，此方法主要用于前端状态同步
	 */
	async saveCurrentSession(): Promise<void> {
		try {
			const state = this.store.getState();

			if (!state.sessionId) {
				throw new ServiceError("NO_SESSION_ID", "No session ID available");
			}

			// 会话在服务器端自动保存，这里只需确保状态一致
			console.log("[ChatController] 会话状态已同步，服务器端自动保存");
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
			// 使用WebSocket创建新会话
			return new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("创建新会话超时"));
				}, 5000);

				const unsubscribe = websocketService.on("session_created", (data) => {
					clearTimeout(timeout);
					// 更新store
					this.store.getState().reset();
					this.store.getState().setSessionId(data.sessionId);
					unsubscribe();
					resolve(data.sessionId);
				});

				websocketService.send("new_session");
			});
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
	async getAvailableModels(): Promise<
		Array<{ id: string; name: string; provider: string; description: string }>
	> {
		try {
			// 使用WebSocket获取模型列表
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("获取模型列表超时"));
				}, 5000);

				const unsubscribe = websocketService.on("models_list", (data) => {
					clearTimeout(timeout);
					unsubscribe();
					resolve(data.models || []);
				});

				websocketService.listModels();
			});
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
			// 查找模型提供者（这里需要从模型列表中获取）
			// 暂时使用默认提供者
			const provider = "deepseek"; // 默认提供者

			// 使用WebSocket设置模型
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("设置模型超时"));
				}, 5000);

				const unsubscribe = websocketService.on("model_set", (data) => {
					clearTimeout(timeout);
					this.store.getState().setCurrentModel(modelId);
					unsubscribe();
					resolve();
				});

				websocketService.setModel(provider, modelId);
			});
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
			// 系统提示通过HTTP API获取
			const response = await fetch("/api/system-prompt");
			if (!response.ok) {
				throw new Error(`获取系统提示失败: ${response.status}`);
			}
			const data = await response.json();
			return data.systemPrompt || "";
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
			// 系统提示更新可能通过其他方式处理
			console.warn("[ChatController] 更新系统提示功能暂未实现");
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
				// 清除聊天历史可以通过创建新会话实现
				await this.createSession("New Session");
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
			// 重新生成消息通过发送相同的用户消息实现
			const state = this.store.getState();
			const messageIndex = state.messages.findIndex((m) => m.id === messageId);

			if (messageIndex !== -1) {
				const newMessages = state.messages.slice(0, messageIndex);
				this.store.getState().setMessages(newMessages);

				// 重新发送用户消息
				const message = state.messages[messageIndex];
				if (message && message.role === "user") {
					const text =
						message.content.find((c) => c.type === "text")?.text || "";
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
			// 搜索消息功能暂未实现
			console.warn("[ChatController] 搜索消息功能暂未实现");

			// 更新store中的搜索结果
			this.store.getState().setSearchResults([]);
			this.store.getState().setSearching(false);

			return [];
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
	 * 设置WebSocket监听器（公开方法，供外部调用）
	 */
	setupWebSocketListeners(): void {
		// 防止重复设置监听器
		if (this.listenersSetup) {
			return;
		}
		this.listenersSetup = true;

		// 内容增量 - 使用 RAF 批处理优化
		websocketService.on("content_delta", (data) => {
			if (data?.text || data?.delta) {
				this.store.getState().appendStreamingContent(data.text || data.delta);
			}
		});

		// 思考增量 - 使用 RAF 批处理优化
		websocketService.on("thinking_delta", (data) => {
			if (data?.thinking || data?.delta) {
				this.store.getState().appendStreamingThinking(data.thinking || data.delta);
			}
		});

		// 工具调用增量 - 流式显示工具调用构建过程
		websocketService.on("toolcall_delta", (data) => {
			try {
				if (data?.toolCallId && data?.toolName) {
					this.store.getState().appendToolCallDelta(
						data.toolCallId,
						data.toolName,
						data.delta || "",
					);
				}
			} catch (error) {
				console.error(
					"[ChatController] Error in toolcall_delta handler:",
					error,
				);
			}
		});

		// 工具开始
		websocketService.on("tool_start", (data) => {
			try {
				console.log("[ChatController] tool_start event received:", data);
				console.log("[ChatController] tool_start data type:", typeof data);

				// 确保data有必要的属性
				if (!data || typeof data !== "object") {
					console.error("[ChatController] Invalid tool_start data:", data);
					return;
				}

				// 检查data是否有必要的属性
				const toolCallId = data.toolCallId || `tool-${Date.now()}`;
				const toolName = data.toolName || "unknown";
				const args = data.args || {};

				console.log("[ChatController] Creating tool:", {
					toolCallId,
					toolName,
					args,
				});

				const tool: ToolExecution = {
					id: toolCallId,
					name: toolName,
					args: args,
					status: "executing",
					startTime: new Date(),
				};

				this.store.getState().setActiveTool(tool);
			} catch (error) {
				console.error(
					"[ChatController] Error in tool_start handler:",
					error,
					"data:",
					data,
				);
			}
		});

		// 工具更新
		websocketService.on("tool_update", (data) => {
			try {
				console.log("[ChatController] tool_update event received:", data);
				// 后端发送的是chunk字段，不是output
				const output = data.chunk || "";
				this.store
					.getState()
					.updateToolOutput(data.toolCallId, output, undefined);
			} catch (error) {
				console.error("[ChatController] Error in tool_update handler:", error);
			}
		});

		// 工具结束
		websocketService.on("tool_end", (data) => {
			try {
				console.log("[ChatController] tool_end event received:", data);
				// 后端发送的是result和isError字段，不是output和error
				const output = data.result || "";
				const error = data.isError ? "工具执行失败" : undefined;
				this.store.getState().updateToolOutput(data.toolCallId, output, error);
			} catch (error) {
				console.error("[ChatController] Error in tool_end handler:", error);
			}
		});

		// 代理结束
		websocketService.on("agent_end", () => {
			this.finalizeStreamingMessage();
		});

		// 消息开始/结束
		websocketService.on("message_start", () => {
			console.log("[ChatController] Message started");
		});

		websocketService.on("message_end", () => {
			console.log("[ChatController] Message ended");
		});

		// 轮次开始/结束
		websocketService.on("turn_start", () => {
			console.log("[ChatController] Turn started, calling startNewTurn");
			this.store.getState().startNewTurn();
		});

		websocketService.on("turn_end", (data) => {
			console.log("[ChatController] Turn ended:", data);
		});

		// 压缩开始/结束
		websocketService.on("compaction_start", () => {
			console.log("[ChatController] Compaction started");
		});

		websocketService.on("compaction_end", () => {
			console.log("[ChatController] Compaction ended");
		});

		// 重试开始/结束
		websocketService.on("retry_start", () => {
			console.log("[ChatController] Retry started");
		});

		websocketService.on("retry_end", () => {
			console.log("[ChatController] Retry ended");
		});

		// 连接状态变化
		websocketService.on("connected", () => {
			console.log("[ChatController] WebSocket connected");
		});

		websocketService.on("disconnected", () => {
			console.log("[ChatController] WebSocket disconnected");
			// 如果正在流式生成，中止
			if (this.store.getState().isStreaming) {
				this.store.getState().abortStreaming();
			}
		});
	}

	/**
	 * 完成流式消息
	 */
	private finalizeStreamingMessage(): void {
		// 使用 finishStreaming 完成消息，它会将消息添加到 messages 数组
		// 不需要额外调用 addMessage，避免重复添加
		this.store.getState().finishStreaming();
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
			this.store.getState().abortStreaming();
		}
	}
}

// 导出单例
export const chatController = new ChatController();
