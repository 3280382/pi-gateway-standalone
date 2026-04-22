/**
 * WebSocket Handler Utilities
 * Common utilities and helper functions for WebSocket handlers
 */

import { existsSync } from "node:fs";
import { Logger, LogLevel } from "../../../lib/utils/logger.js";
import type { WSContext } from "../ws-router.js";

export const logger = new Logger({ level: LogLevel.INFO });

/**
 * Send success response
 */
export function sendSuccess(
  ctx: WSContext,
  type: string,
  data: Record<string, unknown> = {}
): void {
  ctx.ws.send(
    JSON.stringify({
      type,
      ...data,
    })
  );
}

/**
 * Send error response
 */
export function sendError(ctx: WSContext, message: string, messageType?: string): void {
  ctx.ws.send(
    JSON.stringify({
      type: "error",
      error: message,
      ...(messageType ? { messageType } : {}),
    })
  );
}

/**
 * Check if session is initialized
 * Returns true if session is valid, false otherwise
 */
export function checkSessionInitialized(ctx: WSContext): boolean {
  if (!ctx.session.session) {
    sendError(ctx, "Session not initialized, please send init message first");
    return false;
  }
  return true;
}

/**
 * Check if path exists
 */
export function checkPathExists(path: string, ctx: WSContext): boolean {
  if (!existsSync(path)) {
    sendError(ctx, `Path does not exist: ${path}`);
    return false;
  }
  return true;
}

/**
 * Wrap handler with common error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (ctx: WSContext, ...args: T) => Promise<void>
): (ctx: WSContext, ...args: T) => Promise<void> {
  return async (ctx: WSContext, ...args: T): Promise<void> => {
    try {
      await handler(ctx, ...args);
    } catch (error) {
      logger.error("[Handler] Error:", {}, error instanceof Error ? error : undefined);
      sendError(
        ctx,
        error instanceof Error ? error.message : "Error occurred while processing message"
      );
    }
  };
}

/**
 * Create a handler that requires session to be initialized
 */
export function requireSession<T extends unknown[]>(
  handler: (ctx: WSContext, ...args: T) => Promise<void>
): (ctx: WSContext, ...args: T) => Promise<void> {
  return async (ctx: WSContext, ...args: T): Promise<void> => {
    if (!checkSessionInitialized(ctx)) {
      return;
    }
    await handler(ctx, ...args);
  };
}

/**
 * Create a handler with logging
 */
export function withLogging<T extends unknown[]>(
  handler: (ctx: WSContext, ...args: T) => Promise<void>,
  handlerName: string
): (ctx: WSContext, ...args: T) => Promise<void> {
  return async (ctx: WSContext, ...args: T): Promise<void> => {
    logger.info(`[${handlerName}] Processing message`);
    await handler(ctx, ...args);
    logger.info(`[${handlerName}] Completed`);
  };
}

/**
 * Handler factory - creates a handler with logging, error handling and session check
 */
export function createHandler<T extends unknown[]>(
  handler: (ctx: WSContext, ...args: T) => Promise<void>,
  options: {
    name: string;
    requireSession?: boolean;
  }
): (ctx: WSContext, ...args: T) => Promise<void> {
  let wrapped = handler;

  if (options.requireSession) {
    wrapped = requireSession(wrapped);
  }

  wrapped = withErrorHandling(wrapped);
  wrapped = withLogging(wrapped, options.name);

  return wrapped;
}
