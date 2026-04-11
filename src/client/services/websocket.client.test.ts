/**
 * WebSocket Client Integration Tests
 * 测试 WebSocket 连接和消息处理 (mock server)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.(new Event("open"));
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== 1) {
      throw new Error("WebSocket is not open");
    }
    // Echo back for testing
    setTimeout(() => {
      this.onmessage?.(new MessageEvent("message", { data }));
    }, 5);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.(new CloseEvent("close"));
  }
}

// Replace global WebSocket
global.WebSocket = MockWebSocket as any;

// WebSocket Client implementation to test
class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error("Failed to parse message:", e);
          }
        };

        this.ws.onclose = () => {
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  send(type: string, payload: any) {
    if (this.ws?.readyState !== 1) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  on(event: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)?.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  private handleMessage(data: any) {
    const event = data.type;
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect();
      }, 1000 * this.reconnectAttempts);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === 1;
  }
}

describe("WebSocketClient", () => {
  let client: WebSocketClient;

  beforeEach(() => {
    client = new WebSocketClient("ws://localhost:3000/ws");
  });

  afterEach(() => {
    client.disconnect();
  });

  describe("Connection", () => {
    it("should connect to WebSocket server", async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("should disconnect from server", async () => {
      await client.connect();
      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("Message Sending", () => {
    it("should send message when connected", async () => {
      await client.connect();

      const message = { text: "Hello" };
      expect(() => client.send("prompt", message)).not.toThrow();
    });

    it("should throw when sending while disconnected", () => {
      expect(() => client.send("prompt", { text: "Hello" })).toThrow("WebSocket not connected");
    });
  });

  describe("Message Handling", () => {
    it("should receive and handle messages", async () => {
      await client.connect();

      const handler = vi.fn();
      client.on("response", handler);

      // Simulate receiving a message
      const mockWs = (client as any).ws as MockWebSocket;
      mockWs.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "response", text: "Test" }),
        })
      );

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ text: "Test" }));
    });

    it("should handle multiple event types", async () => {
      await client.connect();

      const responseHandler = vi.fn();
      const errorHandler = vi.fn();

      client.on("response", responseHandler);
      client.on("error", errorHandler);

      const mockWs = (client as any).ws as MockWebSocket;

      mockWs.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "response", text: "OK" }),
        })
      );

      mockWs.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "error", message: "Failed" }),
        })
      );

      expect(responseHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event Unsubscribe", () => {
    it("should unsubscribe from events", async () => {
      await client.connect();

      const handler = vi.fn();
      const unsubscribe = client.on("response", handler);

      // Unsubscribe
      unsubscribe();

      const mockWs = (client as any).ws as MockWebSocket;
      mockWs.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "response", text: "Test" }),
        })
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Message Types", () => {
    it("should handle prompt messages", async () => {
      await client.connect();

      const handler = vi.fn();
      client.on("prompt_ack", handler);

      const mockWs = (client as any).ws as MockWebSocket;
      mockWs.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "prompt_ack", id: "123" }),
        })
      );

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: "123" }));
    });

    it("should handle streaming content", async () => {
      await client.connect();

      const handler = vi.fn();
      client.on("content", handler);

      const mockWs = (client as any).ws as MockWebSocket;
      mockWs.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "content", delta: "Hello" }),
        })
      );

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ delta: "Hello" }));
    });

    it("should handle tool execution events", async () => {
      await client.connect();

      const handler = vi.fn();
      client.on("tool_start", handler);

      const mockWs = (client as any).ws as MockWebSocket;
      mockWs.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "tool_start",
            toolCallId: "t1",
            toolName: "bash",
          }),
        })
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCallId: "t1",
          toolName: "bash",
        })
      );
    });
  });
});

console.log("[Test] WebSocket Client tests loaded");
