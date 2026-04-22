/**
 * Terminal Session Manager
 * Manages multiple terminal sessions using node-pty for full TTY support
 */

import * as pty from "node-pty";
import { WebSocket } from "ws";
import { Logger, LogLevel } from "../../lib/utils/logger.js";

const logger = new Logger({ level: LogLevel.INFO });

export interface TerminalSessionInfo {
  id: string;
  name: string;
  workingDir: string;
  createdAt: Date;
  process: pty.IPty;
  clients: Set<WebSocket>;
  cols: number;
  rows: number;
}

export interface TerminalSessionCreateOptions {
  name?: string;
  workingDir?: string;
  cols?: number;
  rows?: number;
}

/**
 * Terminal Session Manager
 * Singleton pattern for managing all terminal sessions with full PTY support
 */
export class TerminalSessionManager {
  private sessions: Map<string, TerminalSessionInfo> = new Map();
  private idCounter = 0;

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `term_${++this.idCounter}_${Date.now()}`;
  }

  /**
   * Create new terminal session with node-pty
   */
  createSession(ws: WebSocket, options: TerminalSessionCreateOptions = {}): TerminalSessionInfo {
    const id = this.generateSessionId();
    const name = options.name || `Terminal ${this.idCounter}`;
    const workingDir = options.workingDir || process.cwd();
    const cols = options.cols || 80;
    const rows = options.rows || 24;

    logger.info(`[Terminal] Creating PTY session ${id} in ${workingDir}`);

    // Spawn shell with node-pty for full TTY support
    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    const shellArgs = process.platform === "win32" ? [] : ["--login"];

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: workingDir,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
    });

    const session: TerminalSessionInfo = {
      id,
      name,
      workingDir,
      createdAt: new Date(),
      process: ptyProcess,
      clients: new Set([ws]),
      cols,
      rows,
    };

    this.sessions.set(id, session);
    this.setupProcessHandlers(session);

    logger.info(`[Terminal] PTY session ${id} created with PID ${ptyProcess.pid}`);

    return session;
  }

  /**
   * Setup process event handlers for streaming output
   */
  private setupProcessHandlers(session: TerminalSessionInfo): void {
    const { process: ptyProcess, id } = session;

    // Handle data output (streaming)
    ptyProcess.onData((data: string) => {
      this.broadcastToClients(session, {
        type: "terminal_output",
        sessionId: id,
        data,
        isError: false,
      });
    });

    // Handle process exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      logger.info(`[Terminal] Session ${id} exited with code ${exitCode}, signal ${signal}`);

      this.broadcastToClients(session, {
        type: "terminal_ended",
        sessionId: id,
        exitCode: exitCode ?? undefined,
        signal: signal ?? undefined,
      });

      this.sessions.delete(id);
    });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcastToClients(session: TerminalSessionInfo, message: unknown): void {
    const messageStr = JSON.stringify(message);

    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          logger.error(`[Terminal] Failed to send to client:`, {}, error as Error);
          session.clients.delete(client);
        }
      } else {
        session.clients.delete(client);
      }
    }
  }

  /**
   * Get existing session by ID
   */
  getSession(id: string): TerminalSessionInfo | undefined {
    return this.sessions.get(id);
  }

  /**
   * Add client WebSocket to existing session
   */
  addClientToSession(sessionId: string, ws: WebSocket): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    session.clients.add(ws);
    return true;
  }

  /**
   * Remove client from session
   */
  removeClientFromSession(sessionId: string, ws: WebSocket): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    session.clients.delete(ws);
    return true;
  }

  /**
   * Execute command in terminal session
   */
  executeCommand(sessionId: string, command: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`[Terminal] Session ${sessionId} not found for command execution`);
      return false;
    }

    try {
      session.process.write(`${command}\r`);
      logger.debug(`[Terminal] Command sent to session ${sessionId}: ${command.slice(0, 100)}`);
      return true;
    } catch (error) {
      logger.error(`[Terminal] Failed to write to session ${sessionId}:`, {}, error as Error);
      return false;
    }
  }

  /**
   * Resize terminal
   */
  resizeTerminal(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      session.process.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
      return true;
    } catch (error) {
      logger.error(`[Terminal] Failed to resize session ${sessionId}:`, {}, error as Error);
      return false;
    }
  }

  /**
   * Close terminal session
   */
  closeSession(sessionId: string, force = false): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    logger.info(`[Terminal] Closing session ${sessionId}${force ? " (force)" : ""}`);

    try {
      if (force) {
        session.process.kill("SIGKILL");
      } else {
        session.process.kill("SIGTERM");
        // Force kill after timeout
        setTimeout(() => {
          try {
            session.process.kill("SIGKILL");
          } catch {
            // Ignore
          }
        }, 5000);
      }
    } catch (error) {
      logger.error(`[Terminal] Error closing session ${sessionId}:`, {}, error as Error);
    }

    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * List all active sessions
   */
  listSessions(): Array<{
    id: string;
    name: string;
    workingDir: string;
    createdAt: string;
  }> {
    return Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      name: session.name,
      workingDir: session.workingDir,
      createdAt: session.createdAt.toISOString(),
    }));
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup all sessions (for server shutdown)
   */
  cleanupAll(): void {
    logger.info(`[Terminal] Cleaning up ${this.sessions.size} sessions`);

    for (const [_id, session] of this.sessions) {
      try {
        session.process.kill("SIGKILL");
      } catch {
        // Ignore
      }
    }

    this.sessions.clear();
  }

  /**
   * Remove client from all sessions (when WebSocket disconnects)
   */
  removeClientFromAllSessions(ws: WebSocket): void {
    for (const session of this.sessions.values()) {
      session.clients.delete(ws);
    }
  }
}

// Export singleton instance
export const terminalSessionManager = new TerminalSessionManager();
