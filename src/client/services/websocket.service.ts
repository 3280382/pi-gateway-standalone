/**
 * WebSocket Service - 处理实时通信
 */

import type { ChatWebSocketMessage, Message, ToolExecution } from "@/types/chat";
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
	| "system_notification";

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
	private heartbeatInterval: NodeJS.Timeout | null = null;
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
					this.startHeartbeat();
					this.emit("connected", this.connectionStatus);
					resolve();
				};

				this.ws.onclose = (event) => {
					console.log(`[WebSocket] Disconnected: ${event.code} ${event.reason}`);
					this.connectionStatus.isConnected = false;
					this.stopHeartbeat();
					this.emit("disconnected", { code: event.code, reason: event.reason });

					// 自动重连
					if (this.reconnectAttempts < this.maxReconnectAttempts) {
						this.reconnectAttempts++;
						const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
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
					reject(new ServiceError("WEBSOCKET_CONNECT_FAILED", "Failed to connect to WebSocket", error));
				};

				this.ws.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data);
						this.handleIncomingMessage(message);
					} catch (error) {
						console.error("[WebSocket] Failed to parse message:", error, event.data);
					}
				};
			} catch (error) {
				reject(new ServiceError("WEBSOCKET_INIT_FAILED", "Failed to initialize WebSocket", error));
			}
		});
	}

	/**
	 * 断开WebSocket连接
	 */
	disconnect(code?: number, reason?: string): void {
		if (this.ws) {
			console.log("[WebSocket] Disconnecting...");
			this.stopHeartbeat();
			this.ws.close(code || 1000, reason || "Normal closure");
			this.ws = null;
			this.connectionStatus.isConnected = false;
		}
	}

	/**
	 * 发送消息
	 */
	send<T = any>(type: string, data?: T): boolean {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn("[WebSocket] Cannot send message: WebSocket not connected");
			return false;
		}

		try {
			const message: WebSocketMessage<T> = {
				type,
				data: data as T,
				timestamp: new Date().toISOString(),
			};

			this.ws.send(JSON.stringify(message));
			console.log(`[WebSocket] Sent: ${type}`);
			return true;
		} catch (error) {
			console.error("[WebSocket] Failed to send message:", error);
			return false;
		}
	}

	/**
	 * 发送聊天消息
	 */
	sendMessage(text: string, sessionId?: string, model?: string): boolean {
		return this.send("message", {
			text,
			sessionId,
			model,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * 中止生成
	 */
	abortGeneration(): boolean {
		return this.send("abort_generation");
	}

	/**
	 * 切换会话
	 */
	switchSession(sessionId: string, workspace?: string): boolean {
		return this.send("switch_session", {
			sessionId,
			workspace,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * 切换工作目录
	 */
	switchWorkingDirectory(path: string): boolean {
		return this.send("switch_working_directory", {
			path,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * 更新工具状态
	 */
	updateToolStatus(toolId: string, status: "executing" | "success" | "error", output?: any, error?: string): boolean {
		return this.send("tool_status", {
			toolId,
			status,
			output,
			error,
			timestamp: new Date().toISOString(),
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
	 * 测试连接延迟
	 */
	async testLatency(): Promise<number> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new ServiceError("WEBSOCKET_NOT_CONNECTED", "WebSocket is not connected");
		}

		return new Promise((resolve) => {
			const startTime = Date.now();
			const pingId = `ping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			const handler = () => {
				const latency = Date.now() - startTime;
				resolve(latency);
				this.off("pong", handler);
			};

			this.on("pong", handler);

			this.send("ping", { id: pingId, timestamp: startTime });

			// 超时处理
			setTimeout(() => {
				this.off("pong", handler);
				resolve(-1);
			}, 5000);
		});
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
			case "pong":
				this.emit("pong", data);
				break;
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
	 * 开始心跳检测
	 */
	private startHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
		}

		this.heartbeatInterval = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.send("heartbeat", { timestamp: Date.now() });
			}
		}, 30000); // 每30秒发送一次心跳
	}

	/**
	 * 停止心跳检测
	 */
	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
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
