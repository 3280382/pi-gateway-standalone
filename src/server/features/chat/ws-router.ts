/**
 * WebSocket Message Router
 * Distributes WebSocket messages to corresponding handlers
 *
 * Design Principles:
 * - Express-like routing style
 * - Supports async handlers
 * - Unified error handling
 * - Extensible, supports middleware
 */

import type { WebSocket } from "ws";
import { Logger, LogLevel } from "../../lib/utils/logger.js";
import type { PiAgentSession } from "./session/PiAgentSession.js";

const logger = new Logger({ level: LogLevel.INFO });

// ============================================================================
// Type Definitions (formerly types.ts)
// ============================================================================

/**
 * Base type for WebSocket message payload
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WSMessagePayload {
  [key: string]: unknown;
}

/**
 * WebSocket Context
 * Each WebSocket connection has its own context
 */
export interface WSContext {
  /** WebSocket connection */
  ws: WebSocket;
  /** Gateway session (current active session for this connection) */
  session: PiAgentSession;
  /** Connection ID */
  connectionId: string;
  /** Connection time */
  connectedAt: Date;
  /** Whether client sidebar is visible (for optimizing status broadcasts) */
  sidebarVisible?: boolean;
  /** Selected session ID for this connection (for strict message routing) */
  selectedSessionId?: string;
  /** Working directory for this connection */
  workingDir?: string;
}

/**
 * Message handler type
 */
export type WSHandler = (
  ctx: WSContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
) => Promise<void> | void;

/**
 * Middleware function type
 */
export type WSMiddleware = (
  ctx: WSContext,
  payload: WSMessagePayload,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Route item
 */
export interface WSRoute {
  type: string;
  handler: WSHandler;
}

// ============================================================================
// WSRouter Implementation (formerly ws-router.ts)
// ============================================================================

/**
 * WebSocket Router
 * Manages message type to handler mapping
 */
export class WSRouter {
  private routes: Map<string, WSHandler> = new Map();
  private middlewares: WSMiddleware[] = [];
  private errorHandler?: (error: Error, ctx: WSContext, type: string) => void;

  /**
   * Register message handler
   * @param type Message type
   * @param handler Handler function
   */
  register(type: string, handler: WSHandler): void {
    if (this.routes.has(type)) {
      logger.warn(`[WSRouter] Message type "${type}" already registered, will be overwritten`);
    }
    this.routes.set(type, handler);
    logger.info(`[WSRouter] Registered handler: ${type}`);
  }

  /**
   * Batch register message handlers
   * @param routes Route array
   */
  registerBatch(routes: WSRoute[]): void {
    for (const { type, handler } of routes) {
      this.register(type, handler);
    }
  }

  /**
   * Remove message handler
   * @param type Message type
   */
  unregister(type: string): void {
    this.routes.delete(type);
    logger.info(`[WSRouter] Unregistered handler: ${type}`);
  }

  /**
   * Add middleware
   * @param middleware Middleware function
   */
  use(middleware: WSMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Set error handler
   * @param handler Error handler
   */
  setErrorHandler(handler: (error: Error, ctx: WSContext, type: string) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Dispatch message to corresponding handler
   * @param type Message type
   * @param ctx WebSocket context
   * @param payload Message payload
   */
  async dispatch(type: string, ctx: WSContext, payload: WSMessagePayload): Promise<void> {
    const handler = this.routes.get(type);

    if (!handler) {
      logger.warn(`[WSRouter] No handler found for message type "${type}"`);
      ctx.ws.send(
        JSON.stringify({
          type: "error",
          error: `Unknown message type: ${type}`,
        })
      );
      return;
    }

    try {
      // Build middleware chain
      const executeHandler = async () => {
        await handler(ctx, payload);
      };

      // Apply middleware
      await this.applyMiddlewares(ctx, payload, executeHandler);
    } catch (error) {
      logger.error(
        `[WSRouter] Error processing message "${type}":`,
        {},
        error instanceof Error ? error : undefined
      );

      if (this.errorHandler) {
        this.errorHandler(error as Error, ctx, type);
      } else {
        // Default error handling
        ctx.ws.send(
          JSON.stringify({
            type: "error",
            error:
              error instanceof Error ? error.message : "Error occurred while processing message",
            messageType: type,
          })
        );
      }
    }
  }

  /**
   * Apply middleware chain
   */
  private async applyMiddlewares(
    ctx: WSContext,
    payload: WSMessagePayload,
    finalHandler: () => Promise<void>
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(ctx, payload, next);
      } else {
        await finalHandler();
      }
    };

    await next();
  }

  /**
   * Get list of registered message types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.routes.keys());
  }

  /**
   * Check if message type is registered
   * @param type Message type
   */
  has(type: string): boolean {
    return this.routes.has(type);
  }
}

/**
 * Global WebSocket router instance
 */
export const wsRouter = new WSRouter();

/**
 * Message type validation middleware
 * Validates message format is correct
 */
export const validateMessageMiddleware: WSMiddleware = async (ctx, payload, next) => {
  if (payload === null || payload === undefined) {
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: "Message payload cannot be empty",
      })
    );
    return;
  }
  await next();
};

/**
 * Session check middleware
 * Checks if session is initialized
 */
export const requireSessionMiddleware: WSMiddleware = async (ctx, _payload, next) => {
  if (!ctx.session.session) {
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: "Session not initialized, please send init message first",
      })
    );
    return;
  }
  await next();
};

/**
 * Logging middleware
 * Records message processing logs
 */
export const loggingMiddleware: WSMiddleware = async (_ctx, payload, next) => {
  const type = (payload?.type as string) || "unknown";
  logger.debug(`[WS] Received message: ${type}`);
  await next();
};

// ============================================================================
// Handler Registration
// ============================================================================

import {
  handleGetPortUsageWrapped,
  handleGetProcessDetailsWrapped,
  handleGetProcessTreeWrapped,
} from "../system/ws-handlers.js";
import {
  handleAbortWrapped,
  handleCommandWrapped,
  handleCompactSessionWrapped,
  handleExportSessionWrapped,
  handleListModelsWrapped,
  handleModelChangeWrapped,
  handlePromptWrapped,
  handleSetModelWrapped,
  handleSteerWrapped,
  handleThinkingLevelChangeWrapped,
} from "./ws-handlers/message-handlers.js";
import {
  handleInitWrapped,
  handleListSessionsWrapped,
  handleNewSessionWrapped,
  handleSidebarVisibilityWrapped,
  handleUpdateSessionConfigWrapped,
} from "./ws-handlers/session-handlers.js";
import {
  handleGetTemplateWrapped,
  handleListTemplatesWrapped,
} from "./ws-handlers/template-handlers.js";

/**
 * Register all WebSocket handlers
 */
export function registerAllWSHandlers(): void {
  // Chat core functionality
  wsRouter.register("prompt", handlePromptWrapped);
  wsRouter.register("abort", handleAbortWrapped);
  wsRouter.register("steer", handleSteerWrapped);

  // Model related
  wsRouter.register("set_model", handleSetModelWrapped);
  wsRouter.register("model_change", handleModelChangeWrapped);
  wsRouter.register("list_models", handleListModelsWrapped);
  wsRouter.register("thinking_level_change", handleThinkingLevelChangeWrapped);

  // Bash command execution (via SDK)
  wsRouter.register("command", handleCommandWrapped);

  // Session operations (via SDK)
  wsRouter.register("compact_session", handleCompactSessionWrapped);
  wsRouter.register("export_session", handleExportSessionWrapped);

  // Session management
  wsRouter.register("init", handleInitWrapped);
  wsRouter.register("new_session", handleNewSessionWrapped);
  wsRouter.register("list_sessions", handleListSessionsWrapped);
  wsRouter.register("sidebar_visibility", handleSidebarVisibilityWrapped);
  wsRouter.register("update_session_config", handleUpdateSessionConfigWrapped);

  // System information
  wsRouter.register("get_process_tree", handleGetProcessTreeWrapped);
  wsRouter.register("get_process_details", handleGetProcessDetailsWrapped);
  wsRouter.register("get_port_usage", handleGetPortUsageWrapped);

  // Template operations
  wsRouter.register("list_templates", handleListTemplatesWrapped);
  wsRouter.register("get_template", handleGetTemplateWrapped);

  // Heartbeat - client sends ping, server replies with pong
  wsRouter.register("ping", async (ctx, payload) => {
    // Client sent ping, reply with pong immediately
    const timestamp = (payload as any)?.timestamp || Date.now();
    ctx.ws.send(
      JSON.stringify({
        type: "pong",
        timestamp,
        serverTime: Date.now(),
      })
    );
    logger.debug(`[Heartbeat] Received ping, sent pong`);
  });

  logger.info(`[WSRouter] Registered ${wsRouter.getRegisteredTypes().length} handlers`);
}

// Auto-register handlers
registerAllWSHandlers();
