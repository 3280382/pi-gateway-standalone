/**
 * Terminal WebSocket Service
 * Separate WebSocket service for terminal functionality
 *
 * Design:
 * - Uses separate WebSocket connection from chat (/ws/terminal)
 * - Supports multiple terminal sessions
 * - Stream-based output handling
 */

import { wsLog } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type TerminalEvent =
  | "connected"
  | "disconnected"
  | "error"
  | "terminal_connected"
  | "terminal_created"
  | "terminal_output"
  | "terminal_ended"
  | "terminal_error"
  | "terminal_list"
  | "terminal_attached";

export interface TerminalSession {
  id: string;
  name: string;
  workingDir: string;
  createdAt: string;
}

export interface TerminalOutputMessage {
  type: "terminal_output";
  sessionId: string;
  data: string;
  isError?: boolean;
}

export interface TerminalEndedMessage {
  type: "terminal_ended";
  sessionId: string;
  exitCode?: number;
  signal?: string;
}

export interface TerminalErrorMessage {
  type: "terminal_error";
  sessionId?: string;
  error: string;
}

export interface TerminalCreatedMessage {
  type: "terminal_created";
  sessionId: string;
  name: string;
  workingDir: string;
  createdAt: string;
}

export interface TerminalListMessage {
  type: "terminal_list";
  sessions: TerminalSession[];
}

// ============================================================================
// Terminal WebSocket Service
// ============================================================================

export class TerminalWebSocketService {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<TerminalEvent, Set<(...args: unknown[]) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private connectionId: string | null = null;
  private _isConnected = false;

  constructor() {
    this.setupEventHandlers();
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  /**
   * Connect to terminal WebSocket
   */
  connect(url?: string, timeoutMs = 5000, isReconnect = false): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = url || this.getWebSocketUrl();

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }

        // Only log on first connect or every few reconnects to avoid spam
        if (!isReconnect || this.reconnectAttempts === 0) {
          wsLog.info(`[TerminalWS] Connecting to ${wsUrl}`);
        }

        const timeoutId = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            // Only reject on first connect, let reconnects keep trying
            if (!isReconnect) {
              reject(new Error(`Terminal WebSocket connection timeout (${timeoutMs}ms)`));
            }
          }
        }, timeoutMs);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this._isConnected = true;
          if (this.reconnectAttempts > 0) {
            wsLog.info("[TerminalWS] Reconnected successfully");
          } else {
            wsLog.info("[TerminalWS] Connected");
          }
          this.reconnectAttempts = 0;
          this.emit("connected", { timestamp: new Date().toISOString() });
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeoutId);
          this._isConnected = false;
          this.connectionId = null;
          
          // Only emit disconnected if we were previously connected
          if (this.reconnectAttempts === 0) {
            wsLog.info(`[TerminalWS] Disconnected: ${event.code} ${event.reason}`);
            this.emit("disconnected", { code: event.code, reason: event.reason });
          }

          // Auto reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
            wsLog.info(
              `[TerminalWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
            );

            setTimeout(() => {
              this.connect(wsUrl, timeoutMs, true).catch((err) => {
                // Only log error, don't throw on reconnect failure
                wsLog.error("[TerminalWS] Reconnect attempt failed:", err.message);
              });
            }, delay);
          } else {
            wsLog.error("[TerminalWS] Max reconnection attempts reached");
            if (!isReconnect) {
              reject(new Error("Failed to connect after maximum retry attempts"));
            }
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeoutId);
          // Log error but don't reject here - let onclose handle reconnection
          const errorType = (error as Event).type || 'unknown';
          if (!isReconnect) {
            wsLog.warn(`[TerminalWS] Connection error (will retry): ${errorType}`);
          }
          this.emit("error", error);
          // Don't reject - onclose will trigger reconnection
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleIncomingMessage(message);
          } catch (error) {
            console.error("[TerminalWS] Failed to parse message:", error, event.data);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect terminal WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      wsLog.info("[TerminalWS] Disconnecting...");
      this.ws.close(1000, "Normal closure");
      this.ws = null;
      this._isConnected = false;
      this.connectionId = null;
    }
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  // ========================================================================
  // Message Sending
  // ========================================================================

  /**
   * Send message to server
   */
  private send(type: string, data?: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      wsLog.warn(`[TerminalWS] Cannot send ${type}: not connected`);
      return false;
    }

    try {
      const message = { type, ...data };
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      wsLog.error(`[TerminalWS] Failed to send ${type}:`, error);
      return false;
    }
  }

  /**
   * Create new terminal session
   */
  createSession(options?: {
    name?: string;
    workingDir?: string;
    cols?: number;
    rows?: number;
  }): boolean {
    return this.send("terminal_create", options);
  }

  /**
   * Execute command in terminal session
   */
  executeCommand(sessionId: string, command: string): boolean {
    return this.send("terminal_execute", { sessionId, command });
  }

  /**
   * Resize terminal
   */
  resizeTerminal(sessionId: string, cols: number, rows: number): boolean {
    return this.send("terminal_resize", { sessionId, cols, rows });
  }

  /**
   * Close terminal session
   */
  closeSession(sessionId: string, force?: boolean): boolean {
    return this.send("terminal_close", { sessionId, force });
  }

  /**
   * List all terminal sessions
   */
  listSessions(): boolean {
    return this.send("terminal_list");
  }

  /**
   * Attach to existing session
   */
  attachToSession(sessionId: string): boolean {
    return this.send("terminal_attach", { sessionId });
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  /**
   * Subscribe to event
   */
  on(event: TerminalEvent, handler: (...args: unknown[]) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Unsubscribe from event
   */
  off(event: TerminalEvent, handler: (...args: unknown[]) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit event to handlers
   */
  private emit(event: TerminalEvent, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[TerminalWS] Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Handle incoming message from server
   */
  private handleIncomingMessage(message: Record<string, unknown>): void {
    const { type } = message;

    // Store connection info
    if (type === "terminal_connected" && message.connectionId) {
      this.connectionId = message.connectionId;
    }

    // Route to specific event handlers
    const eventMap: Record<string, TerminalEvent> = {
      terminal_connected: "terminal_connected",
      terminal_created: "terminal_created",
      terminal_output: "terminal_output",
      terminal_ended: "terminal_ended",
      terminal_error: "terminal_error",
      terminal_list: "terminal_list",
      terminal_attached: "terminal_attached",
    };

    const event = eventMap[type];
    if (event) {
      this.emit(event, message);
    } else {
      // Unknown message type, log but don't error
      wsLog.debug(`[TerminalWS] Unknown message type: ${type}`, message);
    }
  }

  /**
   * Setup event handler sets
   */
  private setupEventHandlers(): void {
    const events: TerminalEvent[] = [
      "connected",
      "disconnected",
      "error",
      "terminal_connected",
      "terminal_created",
      "terminal_output",
      "terminal_ended",
      "terminal_error",
      "terminal_list",
      "terminal_attached",
    ];

    events.forEach((event) => {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, new Set());
      }
    });
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /**
   * Get WebSocket URL
   */
  private getWebSocketUrl(): string {
    const backendHost = "127.0.0.1:3000";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${backendHost}/ws/terminal`;
  }
}

// Export singleton instance
export const terminalWebSocketService = new TerminalWebSocketService();
