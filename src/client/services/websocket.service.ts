/**
 * WebSocket Service - 通用 WebSocket 连接服务
 *
 * 职责（重构后）：
 * - 仅提供通用 WebSocket 连接管理
 * - 不包含任何 feature 特定的业务方法
 * - Feature 特定方法请在各自 feature 中封装
 */

// ===== [ANCHOR:IMPORTS] =====

import { wsLog } from "@/lib/logger";

// ===== [ANCHOR:TYPES] =====

// ServiceError definition
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// ===== [ANCHOR:EVENTS] =====

export type WebSocketEvent =
  | "connected"
  | "disconnected"
  | "error"
  | "message"
  // Session Level Events
  | "agent_start"
  | "agent_end"
  | "turn_start"
  | "turn_end"
  // Message Level Events
  | "message_start"
  | "message_end"
  // Content Block Level Events - Text
  | "text_start"
  | "text_delta"
  | "text_end"
  // Content Block Level Events - Thinking
  | "thinking_start"
  | "thinking_delta"
  | "thinking_end"
  // Content Block Level Events - Tool Call (LLM generating)
  | "toolcall_start"
  | "toolcall_delta"
  | "toolcall_end"
  // Tool Execution Level Events (Actual tool running)
  | "tool_execution_start"
  | "tool_execution_update"
  | "tool_execution_end"
  // System Events
  | "compaction_start"
  | "compaction_end"
  | "retry_start"
  | "retry_end"
  | "session_updated"
  | "system_notification"
  | "initialized"
  | "dir_changed"
  | "session_created"
  | "session_loaded"
  | "sessions_list"
  | "model_set"
  | "thinking_set"
  | "models_list"
  | "llm_log_set"
  | "command_result"
  // Session Status Events
  | "runtime_status_broadcast"
  | "session_status"
  | "more_messages_loaded"
  // Reconnection Events
  | "session_reconnected"
  // System Events
  | "process_tree_data"
  | "process_details";

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

// ===== [ANCHOR:WEBSOCKET_SERVICE] =====

export class WebSocketService {
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
    this.setupEventHandlers();
  }

  /**
   * 建立 WebSocket 连接（带超时）
   */
  connect(url?: string, timeoutMs = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = url || this.getWebSocketUrl();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }

        wsLog.info(`Connecting to ${wsUrl}`);

        // 设置连接超时
        const timeoutId = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error(`WebSocket 连接超时 (${timeoutMs}ms)`));
          }
        }, timeoutMs);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
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
          clearTimeout(timeoutId);
          console.log(`[WebSocket] Disconnected: ${event.code} ${event.reason}`);
          this.connectionStatus.isConnected = false;

          this.emit("disconnected", { code: event.code, reason: event.reason });

          // 自动重连
          if (
            this.reconnectAttempts < this.maxReconnectAttempts &&
            this.connectionStatus.lastConnected
          ) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
            console.log(
              `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
            );

            setTimeout(() => {
              this.connect(wsUrl).catch((err) => wsLog.error("Connection error:", err));
            }, delay);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeoutId);
          wsLog.error("Error:", error);
          this.emit("error", error);
          reject(
            new ServiceError("WEBSOCKET_CONNECT_FAILED", "Failed to connect to WebSocket", error)
          );
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
   * 断开 WebSocket 连接
   */
  disconnect(code?: number, reason?: string): void {
    if (this.ws) {
      wsLog.info("Disconnecting...");
      this.ws.close(code || 1000, reason || "Normal closure");
      this.ws = null;
      this.connectionStatus.isConnected = false;
    }
  }

  /**
   * 发送消息（通用方法）
   * 注意：后端期望直接的消息对象，而不是嵌套在 data 字段中
   */
  send<T = any>(type: string, data?: T): boolean {
    if (!this.ws) {
      wsLog.warn("Cannot send message: WebSocket is null");
      return false;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] Cannot send message: WebSocket not OPEN`);
      return false;
    }

    try {
      const message = {
        type,
        ...(data || {}),
      };

      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      return true;
    } catch (error) {
      wsLog.error("Failed to send message:", error);
      return false;
    }
  }

  /**
   * 订阅事件
   */
  on(event: WebSocketEvent, handler: Function): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)?.add(handler);

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
   * 是否已连接
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 获取 WebSocket 状态
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * 获取 WebSocket URL（用于调试）
   */
  getWebSocketUrl(): string {
    const backendHost = "127.0.0.1:3000";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${backendHost}`;
    wsLog.info(`WebSocket URL: ${wsUrl}`);
    return wsUrl;
  }

  /**
   * 处理传入消息
   */
  private handleIncomingMessage(message: any): void {
    const { type, timestamp, sessionId } = message;
    const data = message;

    // 只在非高频事件时打印日志
    if (type !== "content_delta" && type !== "thinking_delta" && type !== "toolcall_delta") {
      wsLog.info(`Received: ${type}`);
    }

    // 触发通用消息事件
    this.emit("message", { type, data, timestamp, sessionId });

    // 触发特定类型事件
    this.emitSpecificEvent(type, data);
  }

  /**
   * 触发特定类型事件
   */
  private emitSpecificEvent(type: string, data: any): void {
    const eventMap: Record<string, WebSocketEvent> = {
      // Session Level
      agent_start: "agent_start",
      agent_end: "agent_end",
      turn_start: "turn_start",
      turn_end: "turn_end",
      // Message Level
      message_start: "message_start",
      message_end: "message_end",
      // Content Block - Text
      text_start: "text_start",
      text_delta: "text_delta",
      text_end: "text_end",
      // Content Block - Thinking
      thinking_start: "thinking_start",
      thinking_delta: "thinking_delta",
      thinking_end: "thinking_end",
      // Content Block - Tool Call
      toolcall_start: "toolcall_start",
      toolcall_delta: "toolcall_delta",
      toolcall_end: "toolcall_end",
      // Tool Execution
      tool_execution_start: "tool_execution_start",
      tool_execution_update: "tool_execution_update",
      tool_execution_end: "tool_execution_end",
      // System Events
      compaction_start: "compaction_start",
      compaction_end: "compaction_end",
      retry_start: "retry_start",
      retry_end: "retry_end",
      error: "error",
      session_updated: "session_updated",
      system_notification: "system_notification",
      initialized: "initialized",
      dir_changed: "dir_changed",
      session_created: "session_created",
      session_loaded: "session_loaded",
      sessions_list: "sessions_list",
      model_set: "model_set",
      thinking_set: "thinking_set",
      models_list: "models_list",
      llm_log_set: "llm_log_set",
      command_result: "command_result",
      // Session Status
      runtime_status_broadcast: "runtime_status_broadcast",
      session_status: "session_status",
      more_messages_loaded: "more_messages_loaded",
      // Reconnection
      session_reconnected: "session_reconnected",
      // System
      process_tree_data: "process_tree_data",
      process_details: "process_details",
    };

    const event = eventMap[type];
    if (event) {
      this.emit(event, data);
    } else {
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
      "message_start",
      "message_end",
      "turn_start",
      "turn_end",
      "compaction_start",
      "compaction_end",
      "retry_start",
      "retry_end",
      "session_updated",
      "system_notification",
      "initialized",
      "dir_changed",
      "session_created",
      "session_loaded",
      "sessions_list",
      "model_set",
      "thinking_set",
      "models_list",
      "llm_log_set",
      "command_result",
      "session_reconnected",
      "process_tree_data",
      "process_details",
    ];

    events.forEach((event) => {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, new Set());
      }
    });
  }
}

// ===== [ANCHOR:EXPORTS] =====

// 导出单例
export const websocketService = new WebSocketService();
