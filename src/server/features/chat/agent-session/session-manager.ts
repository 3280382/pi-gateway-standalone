/**
 * Server-Level Session Manager
 * Manages PiAgentSession lifecycle independently of WebSocket connections
 *
 * Architecture (Consolidated):
 * - PiAgentSession lifecycle is server-level, bound to (workingDir, sessionFile) pair
 * - One PiAgentSession per (workingDir, sessionFile) combination
 * - Session reuse decision is made ONLY here in getOrCreateSession()
 * - On init with same (workingDir, sessionFile): reuse existing session, call session.reconnect(newWs)
 * - On init with different workingDir OR different sessionFile: end old session, create new one
 * - WebSocket disconnect keeps session alive for potential reconnection
 *
 * Key Design:
 * - All session initialization logic is centralized here
 * - Session identity = workingDir + sessionFile (both must match to reuse)
 * - PiAgentSession.initialize() = create NEW session (always creates new AgentSession)
 * - PiAgentSession.reconnect() = reuse EXISTING session (updates WebSocket, re-subscribes events)
 * - No duplicate checks in PiAgentSession (removed from initialize())
 */

import { WebSocket } from "ws";
import type { LlmLogManager } from "../llm/log-manager";
import { PiAgentSession } from "./piAgentSession";

/**
 * Session entry in the server-level registry
 */
interface SessionEntry {
  /** Session instance */
  session: PiAgentSession;
  /** Current working directory */
  workingDir: string;
  /** Current session file path */
  sessionFile: string;
  /** Connected WebSocket client */
  client: WebSocket;
  /** Last activity timestamp */
  lastActivity: Date;
}

/**
 * Server-Level Session Manager
 * Singleton pattern - maintains PiAgentSession across WebSocket connections
 */
export class ServerSessionManager {
  private static instance: ServerSessionManager;
  /** Maps sessionKey (workingDir + sessionFile) to session entry */
  private sessions: Map<string, SessionEntry> = new Map();
  /** Maps workingDir to sessionKey for quick lookup */
  private workingDirToKey: Map<string, string> = new Map();
  /** Maps WebSocket to workingDir for quick lookup on disconnect */
  private clientToWorkingDir: Map<WebSocket, string> = new Map();
  private llmLogManager: LlmLogManager | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ServerSessionManager {
    if (!ServerSessionManager.instance) {
      ServerSessionManager.instance = new ServerSessionManager();
    }
    return ServerSessionManager.instance;
  }

  /**
   * Initialize with LLM log manager
   */
  initialize(llmLogManager: LlmLogManager): void {
    this.llmLogManager = llmLogManager;
  }

  /**
   * Generate unique session key from workingDir and sessionFile
   */
  private getSessionKey(workingDir: string, sessionFile: string): string {
    return `${workingDir}::${sessionFile}`;
  }

  /**
   * Get or create a session for the given working directory and session file
   *
   * Architecture:
   * - If session exists with same (workingDir, sessionFile): reuse PiAgentSession, reconnect
   * - If session exists but different sessionFile: end old, create new
   * - If no session: create new one
   *
   * Key principle: Session identity = workingDir + sessionFile (both must match to reuse)
   *
   * @param workingDir Working directory
   * @param client WebSocket client
   * @param sessionFile Session file path (optional, for identifying specific session)
   * @returns PiAgentSession instance
   */
  async getOrCreateSession(
    workingDir: string,
    client: WebSocket,
    sessionFile?: string
  ): Promise<PiAgentSession> {
    // Generate session key (if no sessionFile provided, use workingDir only for backward compatibility)
    const sessionKey = sessionFile ? this.getSessionKey(workingDir, sessionFile) : workingDir;

    // Check if there's an existing session for this workingDir with different sessionFile
    const existingKeyForDir = this.workingDirToKey.get(workingDir);
    if (existingKeyForDir && existingKeyForDir !== sessionKey) {
      // Different session file for same workingDir - dispose old session
      console.log(
        `[ServerSessionManager] Different sessionFile for same workingDir, disposing old session: ${workingDir}`
      );
      this.disposeSessionByKey(existingKeyForDir);
    }

    const existingEntry = this.sessions.get(sessionKey);

    if (existingEntry) {
      const { client: existingClient, session, sessionFile: existingSessionFile } = existingEntry;

      // Both workingDir and sessionFile match - reuse existing PiAgentSession
      console.log(
        `[ServerSessionManager] Reusing existing session: ${workingDir} + ${existingSessionFile}`
      );

      // Notify old client that it's being replaced (if different client)
      if (existingClient !== client && existingClient.readyState === WebSocket.OPEN) {
        try {
          existingClient.send(
            JSON.stringify({
              type: "session_replaced",
              message: "Another client has taken over this session",
              workingDir,
              sessionFile: existingSessionFile,
            })
          );
        } catch (e) {
          // Ignore send errors
        }
      }

      // Remove old client mapping
      this.clientToWorkingDir.delete(existingClient);

      // Reconnect session with new WebSocket (完整的重新连接逻辑)
      session.reconnect(client);

      // Update entry with new client
      existingEntry.client = client;
      existingEntry.lastActivity = new Date();

      // Update reverse mapping
      this.clientToWorkingDir.set(client, workingDir);

      console.log(`[ServerSessionManager] Session reused with new WebSocket: ${sessionKey}`);
      return session;
    }

    // Create new session
    console.log(
      `[ServerSessionManager] Creating new session: ${workingDir}${sessionFile ? " + " + sessionFile : ""}`
    );

    if (!this.llmLogManager) {
      throw new Error("ServerSessionManager not initialized with LLM log manager");
    }

    const session = new PiAgentSession(client, this.llmLogManager);

    // Initialize the session
    // If sessionFile is provided, the session will be loaded/created for that specific file
    const actualSessionFile = sessionFile || (await this.findMostRecentSessionFile(workingDir));
    await session.initialize(workingDir, actualSessionFile);

    // Register session
    const newSessionKey = this.getSessionKey(workingDir, actualSessionFile);
    this.sessions.set(newSessionKey, {
      session,
      workingDir,
      sessionFile: actualSessionFile,
      client,
      lastActivity: new Date(),
    });

    // Update lookup maps
    this.workingDirToKey.set(workingDir, newSessionKey);

    // Update reverse mapping
    this.clientToWorkingDir.set(client, workingDir);

    console.log(`[ServerSessionManager] Session created and registered: ${newSessionKey}`);
    return session;
  }

  /**
   * Find the most recent session file for a working directory
   */
  private async findMostRecentSessionFile(workingDir: string): Promise<string> {
    const { SessionManager } = await import("@mariozechner/pi-coding-agent");
    const { getLocalSessionsDir } = await import("./utils");

    const localSessionsDir = getLocalSessionsDir(workingDir);
    const sessions = await SessionManager.list(workingDir, localSessionsDir);

    if (sessions.length > 0) {
      const mostRecent = sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime())[0];
      return mostRecent.path;
    }

    // Create new session file path
    const newSessionManager = SessionManager.create(workingDir, localSessionsDir);
    const sessionFile = newSessionManager.getSessionFile();
    if (!sessionFile) {
      throw new Error(`Failed to create session file for workingDir: ${workingDir}`);
    }
    return sessionFile;
  }

  /**
   * Switch session to a new working directory or session file
   *
   * @param currentWorkingDir Current working directory
   * @param newWorkingDir New working directory
   * @param client WebSocket client
   * @param newSessionFile Optional new session file path
   * @returns New PiAgentSession instance
   */
  async switchSession(
    currentWorkingDir: string,
    newWorkingDir: string,
    client: WebSocket,
    newSessionFile?: string
  ): Promise<PiAgentSession> {
    console.log(
      `[ServerSessionManager] Switching session from ${currentWorkingDir} to ${newWorkingDir}${newSessionFile ? " + " + newSessionFile : ""}`
    );

    // End current session for this client
    if (currentWorkingDir) {
      const currentKey = this.workingDirToKey.get(currentWorkingDir);
      if (currentKey) {
        const currentEntry = this.sessions.get(currentKey);
        if (currentEntry && currentEntry.client === client) {
          console.log(`[ServerSessionManager] Ending old session for: ${currentWorkingDir}`);
          this.disposeSessionByKey(currentKey);
        }
      }
    }

    // Get or create session for new working directory
    return this.getOrCreateSession(newWorkingDir, client, newSessionFile);
  }

  /**
   * Disconnect a client from a session
   * Does not dispose the session - keeps it for potential reconnection
   * Pi continues running in the background
   *
   * @param workingDir Working directory
   * @param client WebSocket client
   */
  disconnectClient(workingDir: string, client: WebSocket): void {
    const sessionKey = this.workingDirToKey.get(workingDir);
    if (!sessionKey) return;

    const entry = this.sessions.get(sessionKey);
    if (entry && entry.client === client) {
      console.log(
        `[ServerSessionManager] Client disconnected from: ${workingDir} + ${entry.sessionFile}`
      );
      console.log(`[ServerSessionManager] Session preserved, Pi continues in background`);

      // Mark WebSocket as disconnected (but don't dispose session)
      // Pi continues executing, events will be dropped until reconnection

      // Unsubscribe event handlers to prevent memory leaks
      // Note: We unsubscribe here, but reconnect() will re-subscribe
      if (entry.session.unsubscribeFn) {
        entry.session.unsubscribeFn();
        entry.session.unsubscribeFn = null;
      }

      // Remove reverse mapping
      this.clientToWorkingDir.delete(client);

      // Note: We keep the entry in this.sessions so it can be reconnected
      // The entry.session.ws still points to the old closed WebSocket
      // When reconnect() is called, it will be updated to the new WebSocket
    }
  }

  /**
   * Dispose a session by key and cleanup resources
   *
   * @param sessionKey Session key (workingDir::sessionFile)
   */
  private disposeSessionByKey(sessionKey: string): void {
    const entry = this.sessions.get(sessionKey);
    if (entry) {
      console.log(`[ServerSessionManager] Disposing session: ${sessionKey}`);

      // Remove reverse mapping
      this.clientToWorkingDir.delete(entry.client);

      // Remove workingDir lookup
      this.workingDirToKey.delete(entry.workingDir);

      // Dispose session
      entry.session.dispose();
      this.sessions.delete(sessionKey);
    }
  }

  /**
   * Dispose a session by working directory
   *
   * @param workingDir Working directory
   */
  private disposeSession(workingDir: string): void {
    const sessionKey = this.workingDirToKey.get(workingDir);
    if (sessionKey) {
      this.disposeSessionByKey(sessionKey);
    }
  }

  /**
   * Get session for a working directory
   *
   * @param workingDir Working directory
   * @returns Session entry or undefined
   */
  getSession(workingDir: string): SessionEntry | undefined {
    const sessionKey = this.workingDirToKey.get(workingDir);
    if (sessionKey) {
      return this.sessions.get(sessionKey);
    }
    return undefined;
  }

  /**
   * Get session by working directory and session file
   *
   * @param workingDir Working directory
   * @param sessionFile Session file path
   * @returns Session entry or undefined
   */
  getSessionByFile(workingDir: string, sessionFile: string): SessionEntry | undefined {
    const sessionKey = this.getSessionKey(workingDir, sessionFile);
    return this.sessions.get(sessionKey);
  }

  /**
   * Check if a session exists for a working directory
   *
   * @param workingDir Working directory
   * @returns True if session exists
   */
  hasSession(workingDir: string): boolean {
    const sessionKey = this.workingDirToKey.get(workingDir);
    if (!sessionKey) return false;
    const entry = this.sessions.get(sessionKey);
    return !!(entry && entry.session.session);
  }

  /**
   * Get all active sessions
   *
   * @returns Array of session info
   */
  getAllSessions(): Array<{
    workingDir: string;
    sessionFile: string;
    hasClient: boolean;
    lastActivity: Date;
  }> {
    return Array.from(this.sessions.entries()).map(([sessionKey, entry]) => ({
      workingDir: entry.workingDir,
      sessionFile: entry.sessionFile,
      hasClient: entry.client.readyState === WebSocket.OPEN,
      lastActivity: entry.lastActivity,
    }));
  }

  /**
   * End a specific session (for explicit session termination)
   *
   * @param workingDir Working directory
   */
  endSession(workingDir: string): void {
    console.log(`[ServerSessionManager] Explicitly ending session: ${workingDir}`);
    this.disposeSession(workingDir);
  }

  /**
   * Register a newly created session (used by new-session handler)
   * This is different from getOrCreateSession as it always registers a fresh session
   *
   * @param workingDir Working directory
   * @param client WebSocket client
   * @param session PiAgentSession instance
   * @param sessionFile Session file path
   */
  registerNewSession(
    workingDir: string,
    client: WebSocket,
    session: PiAgentSession,
    sessionFile: string
  ): void {
    const sessionKey = this.getSessionKey(workingDir, sessionFile);
    console.log(`[ServerSessionManager] Registering new session: ${sessionKey}`);

    // Remove any existing entry for this workingDir first
    const existingKey = this.workingDirToKey.get(workingDir);
    if (existingKey) {
      this.disposeSessionByKey(existingKey);
    }

    // Register new session
    this.sessions.set(sessionKey, {
      session,
      workingDir,
      sessionFile,
      client,
      lastActivity: new Date(),
    });

    // Update lookup maps
    this.workingDirToKey.set(workingDir, sessionKey);

    // Update reverse mapping
    this.clientToWorkingDir.set(client, workingDir);

    console.log(`[ServerSessionManager] New session registered: ${sessionKey}`);
  }

  /**
   * Get working directory for a client
   *
   * @param client WebSocket client
   * @returns Working directory or undefined
   */
  getWorkingDirForClient(client: WebSocket): string | undefined {
    return this.clientToWorkingDir.get(client);
  }
}

/**
 * Global server session manager instance
 */
export const serverSessionManager = ServerSessionManager.getInstance();
