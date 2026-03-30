/**
 * WebSocket Service - 处理实时通信
 */

import type {
	ChatWebSocketMessage,
	Message,
	ToolExecution,
} from "@/types/chat";
import { BaseService, ServiceError } from "./base.service";

export type WebSocketEvent =
	| "connected"
	| "disconnected"
	| "error"
	| "message"
	| "content_delta"
	| "thinking_delta"
	| "toolcall_delta"
	| "tool_start"
	| "tool_update"
	| "tool_end"
	| "agent_start"
	| "agent_end"
	| "session_updated"
	| "system_notification"
	| "initialized"
	| "dir_changed"
	| "session_created"
	| "session_loaded"
	| "sessions_list"
	| "model_set"
	| "thinking_set";

export interface WebSocketMessage<T = any> {
	type: string;
	data: T;
	timestamp: string;
	sessionId?: string;
}

export interface ConnectionStatus {
	isConnected: boolean;
	lastConnected?: string;
	reconnectAttempts: number;
	latency?: number;
	url?: string;
}

export class WebSocketService extends BaseService {
	private ws: WebSocket | null = null;
	private eventHandlers: Map<WebSocketEvent, Set<Function>> = new Map();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;
	private reconnectDelay = 1000;
	private connectionStatus: ConnectionStatus = {
		isConnected: false,
		reconnectAttempts: 0,
	};

	constructor() {
		super("WebSocketService");
		this.setupEventHandlers();
	}

	/**
	 * 建立WebSocket连接
	 */
	connect(url?: string): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const wsUrl = url || this.getWebSocketUrl();

				if (this.ws && this.ws.readyState === WebSocket.OPEN) {
					console.log("[WebSocket] Already connected");
					resolve();
					return;
				}

				console.log(`[WebSocket] Connecting to ${wsUrl}`);
				this.ws = new WebSocket(wsUrl);

				this.ws.onopen = () => {
					console.log("[WebSocket] Connected");
					this.connectionStatus = {
						isConnected: true,
						lastConnected: new Date().toISOString(),
						reconnectAttempts: 0,
						url: wsUrl,
					};
					this.reconnectAttempts = 0;

					this.emit("connected", this.connectionStatus);
					resolve();
				};

				this.ws.onclose = (event) => {
					console.log(
						`[WebSocket] Disconnected: ${event.code} ${event.reason}`,
					);
					this.connectionStatus.isConnected = false;

					this.emit("disconnected", { code: event.code, reason: event.reason });

					// 自动重连
					if (this.reconnectAttempts < this.maxReconnectAttempts) {
						this.reconnectAttempts++;
						const delay =
							this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
						console.log(
							`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
						);

						setTimeout(() => {
							this.connect(wsUrl).catch(console.error);
						}, delay);
					}
				};

				this.ws.onerror = (error) => {
					console.error("[WebSocket] Error:", error);
					this.emit("error", error);
					reject(
						new ServiceError(
							"WEBSOCKET_CONNECT_FAILED",
							"Failed to connect to WebSocket",
							error,
						),
					);
				};

				this.ws.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data);
						this.handleIncomingMessage(message);
					} catch (error) {
						console.error(
							"[WebSocket] Failed to parse message:",
							error,
							event.data,
						);
					}
				};
			} catch (error) {
				reject(
					new ServiceError(
						"WEBSOCKET_INIT_FAILED",
						"Failed to initialize WebSocket",
						error,
					),
				);
			}
		});
	}

	/**
	 * 断开WebSocket连接
	 */
	disconnect(code?: number, reason?: string): void {
		if (this.ws) {
			console.log("[WebSocket] Disconnecting...");

			this.ws.close(code || 1000, reason || "Normal closure");
			this.ws = null;
			this.connectionStatus.isConnected = false;
		}
	}

	/**
	 * 发送消息
	 * 注意：后端期望直接的消息对象，而不是嵌套在data字段中
	 */
	send<T = any>(type: string, data?: T): boolean {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn("[WebSocket] Cannot send message: WebSocket not connected");
			return false;
		}

		try {
			// 后端期望的消息格式：直接包含字段的对象
			const message = {
				type,
				...(data || {}),
			};

			this.ws.send(JSON.stringify(message));
			console.log(`[WebSocket] Sent: ${type}`, message);
			return true;
		} catch (error) {
			console.error("[WebSocket] Failed to send message:", error);
			return false;
		}
	}

	/**
	 * 发送聊天消息（对应后端的prompt类型）
	 */
	sendMessage(text: string, sessionId?: string, model?: string): boolean {
		return this.send("prompt", {
			text,
			sessionId,
			model,
		});
	}

	/**
	 * 中止生成（对应后端的abort类型）
	 */
	abortGeneration(): boolean {
		return this.send("abort");
	}

	/**
	 * 切换会话（对应后端的load_session类型）
	 */
	switchSession(sessionId: string, workspace?: string): boolean {
		return this.send("load_session", {
			sessionPath: sessionId, // 注意：后端期望sessionPath字段
		});
	}

	/**
	 * 初始化工作目录（对应后端的init类型）
	 * 返回Promise等待initialized响应
	 */
	initWorkingDirectory(path: string, sessionId?: string): Promise<any> {
		return new Promise((resolve, reject) => {
			// 设置一次性监听器等待initialized响应
			const unsubscribe = this.on("initialized", (data) => {
				unsubscribe();
				resolve(data);
			});

			// 5秒超时
			setTimeout(() => {
				unsubscribe();
				reject(new Error("Timeout waiting for initialization"));
			}, 5000);

			// 发送init消息
			const sent = this.send("init", {
				workingDir: path,
				sessionId,
			});

			if (!sent) {
				unsubscribe();
				reject(new Error("Failed to send init message"));
			}
		});
	}

	/**
	 * 切换工作目录 - 已弃用，使用initWorkingDirectory
	 */
	switchWorkingDirectory(path: string): boolean {
		console.warn("switchWorkingDirectory已弃用，请使用initWorkingDirectory");
		return this.initWorkingDirectory(path);
	}

	/**
	 * 更新工具状态（对应后端的tool_request类型）
	 */
	updateToolStatus(
		toolId: string,
		status: "executing" | "success" | "error",
		output?: any,
		error?: string,
	): boolean {
		// 注意：后端可能需要不同的消息格式
		return this.send("tool_request", {
			toolCallId: toolId,
			toolName: "unknown", // 需要实际工具名
			args: { status, output, error },
		});
	}

	/**
	 * 订阅事件
	 */
	on(event: WebSocketEvent, handler: Function): () => void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set());
		}

		this.eventHandlers.get(event)!.add(handler);

		// 返回取消订阅的函数
		return () => {
			const handlers = this.eventHandlers.get(event);
			if (handlers) {
				handlers.delete(handler);
			}
		};
	}

	/**
	 * 取消订阅事件
	 */
	off(event: WebSocketEvent, handler: Function): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	/**
	 * 获取连接状态
	 */
	getConnectionStatus(): ConnectionStatus {
		return { ...this.connectionStatus };
	}

	/**
	 * 获取WebSocket URL
	 */
	private getWebSocketUrl(): string {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const host = window.location.host;
		return `${protocol}//${host}/ws`;
	}

	/**
	 * 处理传入消息
	 */
	private handleIncomingMessage(message: any): void {
		const { type, data, timestamp, sessionId } = message;

		console.log(`[WebSocket] Received: ${type}`, data ? "(with data)" : "");

		// 首先触发通用消息事件
		this.emit("message", { type, data, timestamp, sessionId });

		// 然后触发特定类型事件
		switch (type) {
			case "content":
				this.emit("content_delta", data);
				break;
			case "thinking":
				this.emit("thinking_delta", data);
				break;
			case "toolcall_delta":
				this.emit("toolcall_delta", data);
				break;
			case "tool_start":
				this.emit("tool_start", data);
				break;
			case "tool_update":
				this.emit("tool_update", data);
				break;
			case "tool_end":
				this.emit("tool_end", data);
				break;
			case "agent_start":
				this.emit("agent_start", data);
				break;
			case "agent_end":
				this.emit("agent_end", data);
				break;
			case "session_updated":
				this.emit("session_updated", data);
				break;
			case "system_notification":
				this.emit("system_notification", data);
				break;
			case "initialized":
				this.emit("initialized", message);
				break;
			case "dir_changed":
				this.emit("dir_changed", message);
				break;
			case "session_loaded":
				this.emit("session_loaded", message);
				break;
			case "sessions_list":
				this.emit("sessions_list", message);
				break;
			case "model_set":
				this.emit("model_set", message);
				break;
			case "thinking_set":
				this.emit("thinking_set", message);
				break;
			// "pong"事件已移除，因为后端不支持
			// case "pong":
			// 	this.emit("pong", data);
			// 	break;
			default:
				console.warn(`[WebSocket] Unknown message type: ${type}`);
		}
	}

	/**
	 * 触发事件
	 */
	private emit(event: WebSocketEvent, data?: any): void {
		const handlers = this.eventHandlers.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(data);
				} catch (error) {
					console.error(`[WebSocket] Error in ${event} handler:`, error);
				}
			});
		}
	}

	/**
	 * 设置事件处理器
	 */
	private setupEventHandlers(): void {
		// 预定义所有事件类型
		const events: WebSocketEvent[] = [
			"connected",
			"disconnected",
			"error",
			"message",
			"content_delta",
			"thinking_delta",
			"toolcall_delta",
			"tool_start",
			"tool_update",
			"tool_end",
			"agent_start",
			"agent_end",
			"session_updated",
			"system_notification",
		];

		events.forEach((event) => {
			if (!this.eventHandlers.has(event)) {
				this.eventHandlers.set(event, new Set());
			}
		});
	}

	/**
	 * 是否已连接
	 */
	get isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	/**
	 * 获取WebSocket状态
	 */
	get readyState(): number {
		return this.ws?.readyState ?? WebSocket.CLOSED;
	}
}

// 导出单例
export const websocketService = new WebSocketService();
