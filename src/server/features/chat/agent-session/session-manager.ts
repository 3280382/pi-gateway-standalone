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
 * Extract short session ID from session file path (fixed 8 characters)
 * Example: "/.../2026-04-17T08-26-10-585Z_019d9a8c-2b19-7345-94f5-5efedb498871.jsonl" -> "5efedb49"
 */
export function extractShortSessionId(sessionFile: string): string {
  if (!sessionFile) return "";
  const fileName = sessionFile.split("/").pop() || "";
  const withoutExt = fileName.replace(".jsonl", "");
  const parts = withoutExt.split("_");
  // Get UUID part (last segment after underscore) and take first 8 chars
  const uuidPart = parts[parts.length - 1] || fileName;
  return uuidPart.slice(0, 8);
}

/**
 * Session runtime status
 */
export type SessionRuntimeStatus = 
  | "idle"        // 空闲，等待输入
  | "thinking"    // AI 正在思考
  | "tooling"     // 正在执行工具
  | "streaming"   // 正在流式输出
  | "waiting"     // 等待用户输入
  | "error";      // 发生错误

/**
 * Session entry in the server-level registry
 */
interface SessionEntry {
  /** Session instance */
  session: PiAgentSession;
  /** Short session ID (extracted from sessionFile) */
  shortId: string;
  /** Current working directory */
  workingDir: string;
  /** Current session file path */
  sessionFile: string;
  /** Connected WebSocket client */
  client: WebSocket;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Current runtime status */
  runtimeStatus: SessionRuntimeStatus;
  /** Whether client's sidebar is visible (for optimizing broadcasts) */
  sidebarVisible?: boolean;
  /** Last broadcasted status (for detecting changes) */
  lastBroadcastedStatus?: SessionRuntimeStatus;
}

/**
 * Server-Level Session Manager
 * Singleton pattern - maintains PiAgentSession across WebSocket connections
 */
export class ServerSessionManager {
  private static instance: ServerSessionManager;
  /** Maps shortId to session entry (PRIMARY KEY) */
  private sessions: Map<string, SessionEntry> = new Map();
  /** Maps workingDir to Set of shortIds */
  private workingDirToShortIds: Map<string, Set<string>> = new Map();
  /** Maps WebSocket to shortId for quick lookup on disconnect */
  private clientToShortId: Map<WebSocket, string> = new Map();
  /** Maps sessionFile to shortId for file-based lookup */
  private sessionFileToShortId: Map<string, string> = new Map();
  private llmLogManager: LlmLogManager | null = null;
  private statusBroadcastInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start runtime status broadcast timer
    this.startStatusBroadcast();
  }

  /**
   * Start periodic runtime status broadcast
   */
  private startStatusBroadcast(): void {
    // Broadcast every 5 seconds
    this.statusBroadcastInterval = setInterval(() => {
      this.broadcastAllRuntimeStatus();
    }, 5000);
  }

  /**
   * Broadcast runtime status for all working directories
   * Optimized: only broadcast to clients with visible sidebar or when status changes
   */
  private broadcastAllRuntimeStatus(): void {
    // Group sessions by workingDir
    const workingDirMap = new Map<string, SessionEntry[]>();
    
    for (const entry of this.sessions.values()) {
      if (!workingDirMap.has(entry.workingDir)) {
        workingDirMap.set(entry.workingDir, []);
      }
      workingDirMap.get(entry.workingDir)!.push(entry);
    }

    // Broadcast for each workingDir
    for (const [workingDir, entries] of workingDirMap) {
      const statusList = entries.map(entry => ({
        shortId: entry.shortId,
        status: entry.runtimeStatus,
        hasClient: entry.client.readyState === WebSocket.OPEN,
      }));

      // Send to clients in this working directory
      for (const entry of entries) {
        // Skip if: client not connected, sidebar not visible, and status hasn't changed
        if (entry.client.readyState !== WebSocket.OPEN) continue;
        
        const shouldBroadcast = entry.sidebarVisible === true || 
                               entry.lastBroadcastedStatus !== entry.runtimeStatus;
        
        if (!shouldBroadcast) continue;

        try {
          entry.client.send(JSON.stringify({
            type: "runtime_status_broadcast",
            workingDir,
            sessions: statusList,
            timestamp: new Date().toISOString(),
          }));
          
          // Update last broadcasted status
          entry.lastBroadcastedStatus = entry.runtimeStatus;
        } catch (e) {
          // Ignore send errors
        }
      }
    }
  }

  /**
   * Stop status broadcast (for cleanup)
   */
  stopStatusBroadcast(): void {
    if (this.statusBroadcastInterval) {
      clearInterval(this.statusBroadcastInterval);
      this.statusBroadcastInterval = null;
    }
  }

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
   * Get short ID from session file
   */
  private getShortId(sessionFile: string): string {
    return extractShortSessionId(sessionFile);
  }

  /**
   * Get session entry by short ID
   */
  getSessionByShortId(shortId: string): SessionEntry | undefined {
    return this.sessions.get(shortId);
  }

  /**
   * Get session entry by session file
   */
  getSessionByFile(sessionFile: string): SessionEntry | undefined {
    const shortId = this.sessionFileToShortId.get(sessionFile);
    if (shortId) {
      return this.sessions.get(shortId);
    }
    // Fallback: search by sessionFile
    for (const entry of this.sessions.values()) {
      if (entry.sessionFile === sessionFile) {
        return entry;
      }
    }
    return undefined;
  }

  /**
   * Get or create a session for the given working directory and session file
   *
   * Architecture:
   * - If session exists with same sessionFile: reuse PiAgentSession, reconnect
   * - If no session: create new one
   * - Primary key: shortId (extracted from sessionFile)
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
    // Determine actual session file
    const actualSessionFile = sessionFile || await this.findMostRecentSessionFile(workingDir);
    const shortId = this.getShortId(actualSessionFile);

    console.log(
      `[ServerSessionManager] getOrCreateSession: workingDir=${workingDir}, shortId=${shortId}, sessionFile=${actualSessionFile}`
    );

    const existingEntry = this.sessions.get(shortId);

    if (existingEntry) {
      const { client: existingClient, session, sessionFile: existingSessionFile } = existingEntry;

      console.log(
        `[ServerSessionManager] Reusing existing session: shortId=${shortId}`
      );

      // Notify old client that it's being replaced (if different client)
      if (existingClient !== client && existingClient.readyState === WebSocket.OPEN) {
        try {
          existingClient.send(
            JSON.stringify({
              type: "session_replaced",
              message: "Another client has taken over this session",
              shortId,
              workingDir,
            })
          );
        } catch (e) {
          // Ignore send errors
        }
      }

      // Remove old client mapping
      this.clientToShortId.delete(existingClient);

      // Reconnect session with new WebSocket
      session.reconnect(client);

      // Update entry with new client
      existingEntry.client = client;
      existingEntry.lastActivity = new Date();
      existingEntry.runtimeStatus = "idle";

      // Update reverse mapping
      this.clientToShortId.set(client, shortId);

      console.log(`[ServerSessionManager] Session reused: shortId=${shortId}`);
      return session;
    }

    // Create new session
    console.log(
      `[ServerSessionManager] Creating new session: shortId=${shortId}`
    );

    if (!this.llmLogManager) {
      throw new Error("ServerSessionManager not initialized with LLM log manager");
    }

    const session = new PiAgentSession(client, this.llmLogManager);

    // Initialize the session
    // Use the actualSessionFile already determined at the beginning of this function
    await session.initialize(workingDir, actualSessionFile);

    // Register session with shortId as primary key
    this.sessions.set(shortId, {
      session,
      shortId,
      workingDir,
      sessionFile: actualSessionFile,
      client,
      lastActivity: new Date(),
      runtimeStatus: "idle",
    });

    // Update lookup maps
    this.sessionFileToShortId.set(actualSessionFile, shortId);
    
    if (!this.workingDirToShortIds.has(workingDir)) {
      this.workingDirToShortIds.set(workingDir, new Set());
    }
    this.workingDirToShortIds.get(workingDir)!.add(shortId);

    // Update reverse mapping
    this.clientToShortId.set(client, shortId);

    console.log(`[ServerSessionManager] Session created: shortId=${shortId}`);
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
    const newShortId = newSessionFile ? this.getShortId(newSessionFile) : "auto";
    console.log(
      `[ServerSessionManager] Switching session: from ${currentWorkingDir} to ${newWorkingDir}, shortId=${newShortId}`
    );

    // End current session for this client
    const currentShortId = this.clientToShortId.get(client);
    if (currentShortId) {
      console.log(`[ServerSessionManager] Ending old session: shortId=${currentShortId}`);
      this.disposeSessionByShortId(currentShortId);
    }

    // Get or create session for new working directory
    return this.getOrCreateSession(newWorkingDir, client, newSessionFile);
  }

  /**
   * Disconnect a client from a session
   * Does not dispose the session - keeps it for potential reconnection
   *
   * @param shortId Short session ID
   * @param client WebSocket client
   */
  disconnectClient(shortId: string, client: WebSocket): void {
    const entry = this.sessions.get(shortId);
    if (!entry || entry.client !== client) return;

    console.log(
      `[ServerSessionManager] Client disconnected: shortId=${shortId}`
    );
    console.log(`[ServerSessionManager] Session preserved, Pi continues in background`);

    // Unsubscribe event handlers to prevent memory leaks
    if (entry.session.unsubscribeFn) {
      entry.session.unsubscribeFn();
      entry.session.unsubscribeFn = null;
    }

    // Remove reverse mapping
    this.clientToShortId.delete(client);

    // Note: We keep the entry in this.sessions so it can be reconnected
  }

  /**
   * Dispose a session by short ID and cleanup resources
   *
   * @param shortId Short session ID
   */
  private disposeSessionByShortId(shortId: string): void {
    const entry = this.sessions.get(shortId);
    if (entry) {
      console.log(`[ServerSessionManager] Disposing session: shortId=${shortId}`);

      // Remove reverse mapping
      this.clientToShortId.delete(entry.client);

      // Remove workingDir lookup
      const shortIds = this.workingDirToShortIds.get(entry.workingDir);
      if (shortIds) {
        shortIds.delete(shortId);
        if (shortIds.size === 0) {
          this.workingDirToShortIds.delete(entry.workingDir);
        }
      }

      // Remove session file mapping
      this.sessionFileToShortId.delete(entry.sessionFile);

      // Dispose session
      entry.session.dispose();
      this.sessions.delete(shortId);
    }
  }

  /**
   * Dispose a session by working directory
   *
   * @param workingDir Working directory
   */
  private disposeSession(workingDir: string): void {
    // Find and dispose the first session for this workingDir
    for (const [shortId, entry] of this.sessions) {
      if (entry.workingDir === workingDir) {
        this.disposeSessionByShortId(shortId);
        break;
      }
    }
  }

  /**
   * Get session for a working directory (returns first match)
   *
   * @param workingDir Working directory
   * @returns Session entry or undefined
   */
  getSession(workingDir: string): SessionEntry | undefined {
    for (const entry of this.sessions.values()) {
      if (entry.workingDir === workingDir) {
        return entry;
      }
    }
    return undefined;
  }

  /**
   * Get all sessions for a working directory
   *
   * @param workingDir Working directory
   * @returns Array of session entries
   */
  getSessionsByWorkingDir(workingDir: string): SessionEntry[] {
    const result: SessionEntry[] = [];
    for (const entry of this.sessions.values()) {
      if (entry.workingDir === workingDir) {
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * Check if a session exists for a working directory
   *
   * @param workingDir Working directory
   * @returns True if session exists
   */
  hasSession(workingDir: string): boolean {
    for (const entry of this.sessions.values()) {
      if (entry.workingDir === workingDir && entry.session.session) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all active sessions with runtime status
   *
   * @returns Array of session info
   */
  getAllSessions(): Array<{
    shortId: string;
    workingDir: string;
    sessionFile: string;
    hasClient: boolean;
    lastActivity: Date;
    runtimeStatus: SessionRuntimeStatus;
  }> {
    return Array.from(this.sessions.entries()).map(([shortId, entry]) => ({
      shortId,
      workingDir: entry.workingDir,
      sessionFile: entry.sessionFile,
      hasClient: entry.client.readyState === WebSocket.OPEN,
      lastActivity: entry.lastActivity,
      runtimeStatus: entry.runtimeStatus,
    }));
  }

  /**
   * End a specific session (for explicit session termination)
   *
   * @param shortId Short session ID
   */
  endSession(shortId: string): void {
    console.log(`[ServerSessionManager] Explicitly ending session: shortId=${shortId}`);
    this.disposeSessionByShortId(shortId);
  }

  /**
   * Register a newly created session (used by new-session handler)
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
    const shortId = this.getShortId(sessionFile);
    console.log(`[ServerSessionManager] Registering new session: shortId=${shortId}`);

    // Register new session with shortId
    this.sessions.set(shortId, {
      session,
      shortId,
      workingDir,
      sessionFile,
      client,
      lastActivity: new Date(),
    });

    // Update lookup maps
    this.sessionFileToShortId.set(sessionFile, shortId);
    
    if (!this.workingDirToShortIds.has(workingDir)) {
      this.workingDirToShortIds.set(workingDir, new Set());
    }
    this.workingDirToShortIds.get(workingDir)!.add(shortId);

    // Update reverse mapping
    this.clientToShortId.set(client, shortId);

    console.log(`[ServerSessionManager] New session registered: shortId=${shortId}`);
  }

  /**
   * Get working directory for a client
   *
   * @param client WebSocket client
   * @returns Working directory or undefined
   */
  getWorkingDirForClient(client: WebSocket): string | undefined {
    const shortId = this.clientToShortId.get(client);
    if (shortId) {
      const entry = this.sessions.get(shortId);
      return entry?.workingDir;
    }
    return undefined;
  }

  /**
   * Get short ID for a client
   *
   * @param client WebSocket client
   * @returns Short session ID or undefined
   */
  getShortIdForClient(client: WebSocket): string | undefined {
    return this.clientToShortId.get(client);
  }

  /**
   * Update runtime status for a session
   *
   * @param shortId Short session ID
   * @param status New runtime status
   */
  updateRuntimeStatus(shortId: string, status: SessionRuntimeStatus): void {
    const entry = this.sessions.get(shortId);
    if (entry) {
      const oldStatus = entry.runtimeStatus;
      entry.runtimeStatus = status;
      entry.lastActivity = new Date();
      
      // If status changed, immediately broadcast to sidebar-visible clients
      if (oldStatus !== status) {
        this.broadcastRuntimeStatus(entry.workingDir);
      }
    }
  }

  /**
   * Get runtime status for a session
   *
   * @param shortId Short session ID
   * @returns Runtime status or undefined
   */
  getRuntimeStatus(shortId: string): SessionRuntimeStatus | undefined {
    return this.sessions.get(shortId)?.runtimeStatus;
  }

  /**
   * Update sidebar visibility for a session's client
   * Used to optimize status broadcasts
   *
   * @param shortId Short session ID
   * @param visible Whether sidebar is visible
   */
  updateSidebarVisibility(shortId: string, visible: boolean): void {
    const entry = this.sessions.get(shortId);
    if (entry) {
      entry.sidebarVisible = visible;
      console.log(`[ServerSessionManager] Sidebar visibility for ${shortId}: ${visible}`);
      
      // If sidebar is now visible, immediately broadcast current status
      if (visible) {
        this.broadcastRuntimeStatus(entry.workingDir);
      }
    }
  }

  /**
   * Broadcast runtime status to all clients in a working directory
   *
   * @param workingDir Working directory
   */
  broadcastRuntimeStatus(workingDir: string): void {
    const sessions = this.getSessionsByWorkingDir(workingDir);
    const statusList = sessions.map(entry => ({
      shortId: entry.shortId,
      status: entry.runtimeStatus,
      hasClient: entry.client.readyState === WebSocket.OPEN,
    }));

    // Send to all clients in this working directory
    sessions.forEach(entry => {
      if (entry.client.readyState === WebSocket.OPEN) {
        try {
          entry.client.send(JSON.stringify({
            type: "runtime_status_broadcast",
            sessions: statusList,
          }));
        } catch (e) {
          // Ignore send errors
        }
      }
    });
  }
}

/**
 * Global server session manager instance
 */
export const serverSessionManager = ServerSessionManager.getInstance();
