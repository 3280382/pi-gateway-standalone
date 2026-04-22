/**
 * Terminal WebSocket Handlers
 * Handles terminal-related WebSocket messages
 */

import type { WebSocket } from "ws";
import { Logger, LogLevel } from "../../../lib/utils/logger.js";
import { terminalSessionManager } from "../terminal-session.js";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle terminal_create message
 * Creates a new terminal session
 */
export function handleTerminalCreate(
  ws: WebSocket,
  payload: {
    sessionName?: string;
    workingDir?: string;
    cols?: number;
    rows?: number;
  }
): void {
  try {
    const session = terminalSessionManager.createSession(ws, {
      name: payload.sessionName,
      workingDir: payload.workingDir,
      cols: payload.cols,
      rows: payload.rows,
    });

    // Send confirmation to client
    ws.send(
      JSON.stringify({
        type: "terminal_created",
        sessionId: session.id,
        name: session.name,
        workingDir: session.workingDir,
        createdAt: session.createdAt.toISOString(),
      })
    );

    logger.info(`[TerminalHandler] Created session ${session.id} for client`);
  } catch (error) {
    logger.error(`[TerminalHandler] Failed to create session:`, {}, error as Error);

    ws.send(
      JSON.stringify({
        type: "terminal_error",
        error: `Failed to create terminal: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
    );
  }
}

/**
 * Handle terminal_execute message
 * Executes a command in an existing terminal session
 */
export function handleTerminalExecute(
  ws: WebSocket,
  payload: {
    sessionId: string;
    command: string;
  }
): void {
  const { sessionId, command } = payload;

  if (!sessionId || !command) {
    ws.send(
      JSON.stringify({
        type: "terminal_error",
        sessionId,
        error: "Missing sessionId or command",
      })
    );
    return;
  }

  // Add client to session if not already added
  terminalSessionManager.addClientToSession(sessionId, ws);

  // Execute command
  const success = terminalSessionManager.executeCommand(sessionId, command);

  if (!success) {
    ws.send(
      JSON.stringify({
        type: "terminal_error",
        sessionId,
        error: `Session ${sessionId} not found or process not available`,
      })
    );
  }
}

/**
 * Handle terminal_resize message
 * Resizes terminal dimensions
 */
export function handleTerminalResize(
  ws: WebSocket,
  payload: {
    sessionId: string;
    cols: number;
    rows: number;
  }
): void {
  const { sessionId, cols, rows } = payload;

  if (!sessionId || typeof cols !== "number" || typeof rows !== "number") {
    ws.send(
      JSON.stringify({
        type: "terminal_error",
        sessionId,
        error: "Missing or invalid sessionId, cols, or rows",
      })
    );
    return;
  }

  const success = terminalSessionManager.resizeTerminal(sessionId, cols, rows);

  if (!success) {
    ws.send(
      JSON.stringify({
        type: "terminal_error",
        sessionId,
        error: `Session ${sessionId} not found`,
      })
    );
  }
}

/**
 * Handle terminal_close message
 * Closes a terminal session
 */
export function handleTerminalClose(
  ws: WebSocket,
  payload: {
    sessionId: string;
    force?: boolean;
  }
): void {
  const { sessionId, force = false } = payload;

  if (!sessionId) {
    ws.send(
      JSON.stringify({
        type: "terminal_error",
        error: "Missing sessionId",
      })
    );
    return;
  }

  const success = terminalSessionManager.closeSession(sessionId, force);

  if (!success) {
    ws.send(
      JSON.stringify({
        type: "terminal_error",
        sessionId,
        error: `Session ${sessionId} not found`,
      })
    );
  }
}

/**
 * Handle terminal_list message
 * Lists all active terminal sessions
 */
export function handleTerminalList(ws: WebSocket): void {
  const sessions = terminalSessionManager.listSessions();

  ws.send(
    JSON.stringify({
      type: "terminal_list",
      sessions,
    })
  );
}

/**
 * Handle terminal_attach message
 * Attaches client to existing session for receiving output
 */
export function handleTerminalAttach(
  ws: WebSocket,
  payload: {
    sessionId: string;
  }
): void {
  const { sessionId } = payload;

  if (!sessionId) {
    ws.send(
      JSON.stringify({
        type: "terminal_error",
        error: "Missing sessionId",
      })
    );
    return;
  }

  const success = terminalSessionManager.addClientToSession(sessionId, ws);

  if (!success) {
    ws.send(
      JSON.stringify({
        type: "terminal_error",
        sessionId,
        error: `Session ${sessionId} not found`,
      })
    );
  } else {
    ws.send(
      JSON.stringify({
        type: "terminal_attached",
        sessionId,
      })
    );
  }
}

/**
 * Handle client disconnection
 * Remove client from all sessions
 */
export function handleTerminalClientDisconnect(ws: WebSocket): void {
  terminalSessionManager.removeClientFromAllSessions(ws);
  logger.debug(`[TerminalHandler] Client disconnected, removed from all sessions`);
}

/**
 * Create wrapped handlers with logging
 */
export function createTerminalHandlers() {
  return {
    terminal_create: (ws: WebSocket, payload: Record<string, unknown>) => {
      logger.debug(`[TerminalHandler] terminal_create:`, payload);
      handleTerminalCreate(ws, payload as Parameters<typeof handleTerminalCreate>[1]);
    },
    terminal_execute: (ws: WebSocket, payload: Record<string, unknown>) => {
      logger.debug(`[TerminalHandler] terminal_execute:`, payload);
      handleTerminalExecute(ws, payload as Parameters<typeof handleTerminalExecute>[1]);
    },
    terminal_resize: (ws: WebSocket, payload: Record<string, unknown>) => {
      logger.debug(`[TerminalHandler] terminal_resize:`, payload);
      handleTerminalResize(ws, payload as Parameters<typeof handleTerminalResize>[1]);
    },
    terminal_close: (ws: WebSocket, payload: Record<string, unknown>) => {
      logger.debug(`[TerminalHandler] terminal_close:`, payload);
      handleTerminalClose(ws, payload as Parameters<typeof handleTerminalClose>[1]);
    },
    terminal_list: (ws: WebSocket, _payload: Record<string, unknown>) => {
      logger.debug(`[TerminalHandler] terminal_list`);
      handleTerminalList(ws);
    },
    terminal_attach: (ws: WebSocket, payload: Record<string, unknown>) => {
      logger.debug(`[TerminalHandler] terminal_attach:`, payload);
      handleTerminalAttach(ws, payload as Parameters<typeof handleTerminalAttach>[1]);
    },
  };
}
