/**
 * Terminal WebSocket Router
 * Separate WebSocket router for terminal functionality
 *
 * Design:
 * - Terminal uses separate WebSocket path from chat (/ws/terminal)
 * - Maintains clean separation between chat and terminal concerns
 * - Supports multiple terminal sessions per WebSocket connection
 */

import type { WebSocket } from "ws";
import { Logger, LogLevel } from "../../lib/utils/logger";
import { terminalSessionManager } from "./terminal-session";
import {
  createTerminalHandlers,
  handleTerminalClientDisconnect,
} from "./ws-handlers/terminal-handlers";

const logger = new Logger({ level: LogLevel.INFO });

// ============================================================================
// Terminal WebSocket Router
// ============================================================================

export interface TerminalWSContext {
  ws: WebSocket;
  connectionId: string;
  connectedAt: Date;
  activeSessions: Set<string>; // Sessions this connection is attached to
}

export type TerminalHandler = (
  ctx: TerminalWSContext,
  payload: Record<string, unknown>
) => void | Promise<void>;

export class TerminalWSRouter {
  private routes: Map<string, TerminalHandler> = new Map();
  private errorHandler?: (error: Error, ctx: TerminalWSContext, type: string) => void;

  /**
   * Register message handler
   */
  register(type: string, handler: TerminalHandler): void {
    if (this.routes.has(type)) {
      logger.warn(`[TerminalWSRouter] Type "${type}" already registered, overwriting`);
    }
    this.routes.set(type, handler);
    logger.info(`[TerminalWSRouter] Registered: ${type}`);
  }

  /**
   * Batch register handlers
   */
  registerBatch(routes: Array<{ type: string; handler: TerminalHandler }>): void {
    for (const { type, handler } of routes) {
      this.register(type, handler);
    }
  }

  /**
   * Set error handler
   */
  setErrorHandler(handler: (error: Error, ctx: TerminalWSContext, type: string) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Dispatch message to handler
   */
  async dispatch(
    type: string,
    ctx: TerminalWSContext,
    payload: Record<string, unknown>
  ): Promise<void> {
    const handler = this.routes.get(type);

    if (!handler) {
      logger.warn(`[TerminalWSRouter] No handler for type: ${type}`);
      ctx.ws.send(
        JSON.stringify({
          type: "terminal_error",
          error: `Unknown message type: ${type}`,
        })
      );
      return;
    }

    try {
      await handler(ctx, payload);
    } catch (error) {
      logger.error(
        `[TerminalWSRouter] Error handling "${type}":`,
        {},
        error instanceof Error ? error : undefined
      );

      if (this.errorHandler) {
        this.errorHandler(error as Error, ctx, type);
      } else {
        ctx.ws.send(
          JSON.stringify({
            type: "terminal_error",
            error: error instanceof Error ? error.message : "Internal error",
          })
        );
      }
    }
  }

  /**
   * Get registered types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.routes.keys());
  }
}

// Global terminal router instance
export const terminalWSRouter = new TerminalWSRouter();

// ============================================================================
// Handler Registration
// ============================================================================

function registerTerminalHandlers(): void {
  const handlers = createTerminalHandlers();

  // Adapt handlers to TerminalWSContext format
  terminalWSRouter.register("terminal_create", (ctx, payload) => {
    handlers.terminal_create(ctx.ws, payload);
    // Track session in context if created
    const sessionId = payload.sessionId as string | undefined;
    if (sessionId) {
      ctx.activeSessions.add(sessionId);
    }
  });

  terminalWSRouter.register("terminal_execute", (ctx, payload) => {
    handlers.terminal_execute(ctx.ws, payload);
  });

  terminalWSRouter.register("terminal_resize", (ctx, payload) => {
    handlers.terminal_resize(ctx.ws, payload);
  });

  terminalWSRouter.register("terminal_close", (ctx, payload) => {
    handlers.terminal_close(ctx.ws, payload);
    const sessionId = payload.sessionId as string | undefined;
    if (sessionId) {
      ctx.activeSessions.delete(sessionId);
    }
  });

  terminalWSRouter.register("terminal_list", (ctx, _payload) => {
    handlers.terminal_list(ctx.ws, {});
  });

  terminalWSRouter.register("terminal_attach", (ctx, payload) => {
    handlers.terminal_attach(ctx.ws, payload);
    const sessionId = payload.sessionId as string | undefined;
    if (sessionId) {
      ctx.activeSessions.add(sessionId);
    }
  });

  logger.info(
    `[TerminalWSRouter] Registered ${terminalWSRouter.getRegisteredTypes().length} handlers`
  );
}

// Auto-register on module load
registerTerminalHandlers();

// ============================================================================
// Connection Manager
// ============================================================================

let connectionCounter = 0;

/**
 * Handle new terminal WebSocket connection
 */
export function handleTerminalConnection(ws: WebSocket): void {
  const connectionId = `term_conn_${++connectionCounter}_${Date.now()}`;
  logger.info(`[TerminalWS] New connection: ${connectionId}`);

  const ctx: TerminalWSContext = {
    ws,
    connectionId,
    connectedAt: new Date(),
    activeSessions: new Set(),
  };

  // Message handler
  ws.on("message", async (data) => {
    let rawMessage: unknown;

    try {
      rawMessage = JSON.parse(data.toString());
    } catch {
      ws.send(
        JSON.stringify({
          type: "terminal_error",
          error: "Invalid JSON message",
        })
      );
      return;
    }

    if (!rawMessage || typeof rawMessage !== "object" || !("type" in rawMessage)) {
      ws.send(
        JSON.stringify({
          type: "terminal_error",
          error: "Message must contain 'type' field",
        })
      );
      return;
    }

    const { type, ...payload } = rawMessage as { type: string };

    try {
      await terminalWSRouter.dispatch(type, ctx, payload);
    } catch (error) {
      logger.error(`[TerminalWS] Error dispatching ${type}:`, {}, error as Error);
    }
  });

  // Close handler
  ws.on("close", () => {
    logger.info(`[TerminalWS] Connection closed: ${connectionId}`);

    // Remove client from all sessions
    handleTerminalClientDisconnect(ws);

    // Clear tracked sessions
    ctx.activeSessions.clear();
  });

  // Error handler
  ws.on("error", (error) => {
    logger.error(`[TerminalWS] Connection error: ${connectionId}`, {}, error);
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "terminal_connected",
      connectionId,
      serverTime: new Date().toISOString(),
    })
  );
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

/**
 * Cleanup all terminal sessions (call on server shutdown)
 */
export function cleanupTerminalSessions(): void {
  terminalSessionManager.cleanupAll();
}
