/**
 * Server-Level Session Manager
 * Manages PiAgentSession lifecycle independently of WebSocket connections
 * 
 * Architecture:
 * - PiAgentSession lifecycle is server-level, not WebSocket connection-level
 * - One PiAgentSession maps to one WebSocket connection (one-to-one)
 * - WebSocket disconnect only unsubscribes events, does not dispose session immediately
 * - On reconnect with same workingDir: reuse existing session, resubscribe events
 * - On init with different workingDir: end old session, create new one
 */

import type { WebSocket } from "ws";
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
  /** Maps workingDir to session entry */
  private sessions: Map<string, SessionEntry> = new Map();
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
   * Get or create a session for the given working directory
   * 
   * Architecture:
   * - If session exists for this workingDir and has no client: reuse it (reconnect scenario)
   * - If session exists but has different client: end old session, create new one
   * - If no session: create new one
   * 
   * @param workingDir Working directory
   * @param client WebSocket client
   * @param sessionId Optional session ID to restore
   * @returns PiAgentSession instance
   */
  async getOrCreateSession(
    workingDir: string,
    client: WebSocket,
    sessionId?: string
  ): Promise<PiAgentSession> {
    const existingEntry = this.sessions.get(workingDir);

    if (existingEntry) {
      const { client: existingClient } = existingEntry;

      // If same client reconnecting, just update activity
      if (existingClient === client) {
        console.log(`[ServerSessionManager] Same client reconnecting to: ${workingDir}`);
        existingEntry.lastActivity = new Date();
        return existingEntry.session;
      }

      // Another client is using this workingDir, kick it out
      console.log(`[ServerSessionManager] New client taking over: ${workingDir}, ending old session`);
      
      // Notify old client that it's being replaced (optional)
      if (existingClient.readyState === WebSocket.OPEN) {
        try {
          existingClient.send(JSON.stringify({
            type: "session_replaced",
            message: "Another client has taken over this session",
            workingDir,
          }));
        } catch (e) {
          // Ignore send errors
        }
      }
      
      // End old session
      this.disposeSession(workingDir);
    }

    // Create new session
    console.log(`[ServerSessionManager] Creating new session for: ${workingDir}`);
    
    if (!this.llmLogManager) {
      throw new Error("ServerSessionManager not initialized with LLM log manager");
    }

    const session = new PiAgentSession(client, this.llmLogManager);
    
    // Initialize the session
    await session.initialize(workingDir, sessionId);

    // Register session
    this.sessions.set(workingDir, {
      session,
      workingDir,
      client,
      lastActivity: new Date(),
    });

    // Update reverse mapping
    this.clientToWorkingDir.set(client, workingDir);

    console.log(`[ServerSessionManager] Session created and registered: ${workingDir}`);
    return session;
  }

  /**
   * Switch session to a new working directory
   * 
   * @param currentWorkingDir Current working directory
   * @param newWorkingDir New working directory
   * @param client WebSocket client
   * @returns New PiAgentSession instance
   */
  async switchSession(
    currentWorkingDir: string,
    newWorkingDir: string,
    client: WebSocket
  ): Promise<PiAgentSession> {
    console.log(`[ServerSessionManager] Switching session from ${currentWorkingDir} to ${newWorkingDir}`);

    // End current session for this client
    if (currentWorkingDir) {
      const currentEntry = this.sessions.get(currentWorkingDir);
      if (currentEntry && currentEntry.client === client) {
        console.log(`[ServerSessionManager] Ending old session for: ${currentWorkingDir}`);
        this.disposeSession(currentWorkingDir);
      }
    }

    // Get or create session for new working directory
    // Note: getOrCreateSession will kick out any existing client for newWorkingDir
    return this.getOrCreateSession(newWorkingDir, client);
  }

  /**
   * Disconnect a client from a session
   * Does not dispose the session - keeps it for potential reconnection
   * 
   * @param workingDir Working directory
   * @param client WebSocket client
   */
  disconnectClient(workingDir: string, client: WebSocket): void {
    const entry = this.sessions.get(workingDir);
    if (entry && entry.client === client) {
      console.log(`[ServerSessionManager] Client disconnected from: ${workingDir}`);
      console.log(`[ServerSessionManager] Session preserved for potential reconnection`);
      
      // Unsubscribe event handlers but keep session alive
      if (entry.session.unsubscribeFn) {
        entry.session.unsubscribeFn();
        entry.session.unsubscribeFn = null;
      }
      
      // Remove reverse mapping
      this.clientToWorkingDir.delete(client);
    }
  }

  /**
   * Dispose a session and cleanup resources
   * 
   * @param workingDir Working directory
   */
  private disposeSession(workingDir: string): void {
    const entry = this.sessions.get(workingDir);
    if (entry) {
      console.log(`[ServerSessionManager] Disposing session: ${workingDir}`);
      
      // Remove reverse mapping
      this.clientToWorkingDir.delete(entry.client);
      
      // Dispose session
      entry.session.dispose();
      this.sessions.delete(workingDir);
    }
  }

  /**
   * Get session for a working directory
   * 
   * @param workingDir Working directory
   * @returns Session entry or undefined
   */
  getSession(workingDir: string): SessionEntry | undefined {
    return this.sessions.get(workingDir);
  }

  /**
   * Check if a session exists for a working directory
   * 
   * @param workingDir Working directory
   * @returns True if session exists
   */
  hasSession(workingDir: string): boolean {
    const entry = this.sessions.get(workingDir);
    return !!(entry && entry.session.session);
  }

  /**
   * Get all active sessions
   * 
   * @returns Array of session info
   */
  getAllSessions(): Array<{ workingDir: string; hasClient: boolean; lastActivity: Date }> {
    return Array.from(this.sessions.entries()).map(([workingDir, entry]) => ({
      workingDir,
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
