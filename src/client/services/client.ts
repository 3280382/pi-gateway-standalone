/**
 * API Client - HTTP and WebSocket
 */

const API_BASE = "/api";

// ============================================================================
// HTTP Client
// ============================================================================

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public response?: any
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => undefined);
    throw new ApiError(response.status, response.statusText, errorBody);
  }

  return response.json();
}

// ============================================================================
// WebSocket Client
// ============================================================================

type MessageHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string = `ws://${window.location.host}`) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] Already connected");
      return;
    }

    console.log("[WebSocket] Connecting to", url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[WebSocket] Connected");
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("[WebSocket] Disconnected");
      this.attemptReconnect(url);
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };
  }

  private handleMessage(message: any) {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error("[WebSocket] Handler error:", error);
        }
      });
    }
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WebSocket] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect(url);
    }, delay);
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("[WebSocket] Not connected, message queued:", message);
      // Could implement message queuing here
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();

// ============================================================================
// Utility Exports
// ============================================================================

export function initConnection() {
  wsClient.connect();
}

// 注：控制器、服务和模型导出已移到各自目录的 index.ts
// 避免循环依赖。请从以下位置导入：
// - 控制器: '../controllers'
// - 服务: '../services'
// - 模型: '../models'
