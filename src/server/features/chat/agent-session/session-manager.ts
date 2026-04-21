/**
 * Server-Level Session Manager
 * Manages PiAgentSession lifecycle, handles strict session-to-client message routing
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
export type SessionStatus =
  | "history" // No active PiAgentSession (file exists but not loaded)
  | "idle"
  | "thinking"
  | "tooling"
  | "streaming"
  | "waiting"
  | "error"
  | "retrying"
  | "compacting";

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
  runtimeStatus: SessionStatus;
  /** Whether client's sidebar is visible (for optimizing broadcasts) */
  sidebarVisible?: boolean;
  /** Last broadcasted status (for detecting changes) */
  lastBroadcastedStatus?: SessionStatus;
}

/**
 * Server-Level Session Manager
 * Singleton pattern - maintains PiAgentSession across WebSocket connections
 */
// Constants
const STATUS_BROADCAST_INTERVAL_MS = 5000;

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
  /** Maps WebSocket to currently VIEWING session ID (not exclusive, background sessions continue running) */
  private clientToViewingSession: Map<WebSocket, string> = new Map();
  private llmLogManager: LlmLogManager | null = null;
  private statusBroadcastInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start runtime status broadcast timer
    this.startStatusBroadcast();
  }

  /**
   * Log with prefix
   */
  private log(message: string): void {
    console.log(`[ServerSessionManager] ${message}`);
  }

  /**
   * Start periodic runtime status broadcast
   */
  private startStatusBroadcast(): void {
    this.statusBroadcastInterval = setInterval(() => {
      this.broadcastAllRuntimeStatus();
    }, STATUS_BROADCAST_INTERVAL_MS);
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
      workingDirMap.get(entry.workingDir)?.push(entry);
    }

    // Broadcast for each workingDir
    for (const [workingDir, entries] of workingDirMap) {
      const statusList = entries.map((entry) => ({
        shortId: entry.shortId,
        status: entry.runtimeStatus,
        hasClient: this.isClientConnected(entry.client),
      }));

      for (const entry of entries) {
        if (!this.shouldBroadcastToClient(entry)) continue;

        try {
          entry.client.send(
            JSON.stringify({
              type: "runtime_status_broadcast",
              workingDir,
              sessions: statusList,
              timestamp: new Date().toISOString(),
            })
          );

          // Update last broadcasted status
          entry.lastBroadcastedStatus = entry.runtimeStatus;
        } catch (_e) {
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
    const actualSessionFile = sessionFile || (await this.findMostRecentSessionFile(workingDir));
    const shortId = this.getShortId(actualSessionFile);

    console.log(
      `[ServerSessionManager] getOrCreateSession: workingDir=${workingDir}, shortId=${shortId}`
    );

    const existing = this.sessions.get(shortId);
    if (existing) {
      return this.reuseSession(existing, client, shortId, workingDir);
    }

    return this.createSession(workingDir, client, actualSessionFile, shortId);
  }

  private reuseSession(
    entry: SessionEntry,
    newClient: WebSocket,
    shortId: string,
    workingDir: string
  ): PiAgentSession {
    const { client: oldClient, session } = entry;

    console.log(`[ServerSessionManager] Reusing session: ${shortId}`);

    // 同一个 WebSocket 切回之前访问过的 session：不需要 reconnect，只更新映射
    if (oldClient === newClient) {
      console.log(`[ServerSessionManager] Same client reusing session ${shortId}, skip reconnect`);
      this.updateEntryClient(entry, newClient);
      this.setupCallbacks(session);
      return session;
    }

    // 不同 WebSocket 接管 session（真正的重连场景）
    this.notifyClientReplaced(oldClient, shortId, workingDir);
    this.clientToShortId.delete(oldClient);

    session.reconnect(newClient);
    this.updateEntryClient(entry, newClient);
    this.setupCallbacks(session);

    return session;
  }

  private async createSession(
    workingDir: string,
    client: WebSocket,
    sessionFile: string,
    shortId: string
  ): Promise<PiAgentSession> {
    console.log(`[ServerSessionManager] Creating session: ${shortId}`);

    if (!this.llmLogManager) {
      throw new Error("LLM log manager not initialized");
    }

    const session = new PiAgentSession(client, this.llmLogManager);
    await session.initialize(workingDir, sessionFile);

    this.registerSession(session, shortId, workingDir, sessionFile, client);
    this.setupCallbacks(session);

    return session;
  }

  private notifyClientReplaced(oldClient: WebSocket, shortId: string, workingDir: string): void {
    if (oldClient.readyState !== WebSocket.OPEN) return;
    try {
      oldClient.send(
        JSON.stringify({
          type: "session_replaced",
          message: "Another client has taken over this session",
          shortId,
          workingDir,
        })
      );
    } catch {
      // Ignore send errors
    }
  }

  private updateEntryClient(entry: SessionEntry, client: WebSocket): void {
    entry.client = client;
    entry.lastActivity = new Date();
    // Keep original runtimeStatus, don't reset (waiting should remain waiting)
    this.clientToShortId.set(client, entry.shortId);
  }

  private registerSession(
    session: PiAgentSession,
    shortId: string,
    workingDir: string,
    sessionFile: string,
    client: WebSocket
  ): void {
    this.sessions.set(shortId, {
      session,
      shortId,
      workingDir,
      sessionFile,
      client,
      lastActivity: new Date(),
      runtimeStatus: "idle",
    });

    this.sessionFileToShortId.set(sessionFile, shortId);
    this.clientToShortId.set(client, shortId);

    if (!this.workingDirToShortIds.has(workingDir)) {
      this.workingDirToShortIds.set(workingDir, new Set());
    }
    this.workingDirToShortIds.get(workingDir)?.add(shortId);
  }

  private setupCallbacks(session: PiAgentSession): void {
    session.setStatusUpdateCallback((shortId, status) => {
      this.updateRuntimeStatus(shortId, status as SessionStatus);
    });
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
   * Get or create session for a session file
   * Background sessions are NOT disposed - they continue running
   *
   * @param workingDir Working directory
   * @param client WebSocket client
   * @param sessionFile Session file path
   * @returns PiAgentSession instance
   */
  async getSessionForFile(
    workingDir: string,
    client: WebSocket,
    sessionFile: string
  ): Promise<PiAgentSession> {
    const shortId = this.getShortId(sessionFile);
    console.log(
      `[ServerSessionManager] Getting session for file: ${sessionFile}, shortId=${shortId}`
    );

    // Get or create session - background sessions continue running
    return this.getOrCreateSession(workingDir, client, sessionFile);
  }

  /**
   * Switch session to a new working directory or session file
   * NOTE: Old session is NOT disposed - it continues running in background
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

    // NOTE: We NO LONGER dispose the old session - it continues running in background
    // Messages from background sessions are buffered until client views them again

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

    console.log(`[ServerSessionManager] Client disconnected: shortId=${shortId}`);
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
   * Get active sessions for a working directory
   *
   * @param workingDir Working directory
   * @returns Array of active session info
   */
  getActiveSessions(workingDir: string): Array<{
    shortId: string;
    sessionFile: string;
    runtimeStatus: SessionStatus;
    hasClient: boolean;
    lastActivity: Date;
  }> {
    const sessions: SessionEntry[] = [];
    const shortIds = this.workingDirToShortIds.get(workingDir);

    if (shortIds) {
      for (const shortId of shortIds) {
        const entry = this.sessions.get(shortId);
        if (entry) {
          sessions.push(entry);
        }
      }
    }

    return sessions.map((entry) => ({
      shortId: entry.shortId,
      sessionFile: entry.sessionFile,
      runtimeStatus: entry.runtimeStatus,
      hasClient: this.isClientConnected(entry.client),
      lastActivity: entry.lastActivity,
    }));
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
   * Check if a WebSocket client is connected
   */
  private isClientConnected(client: WebSocket): boolean {
    return client.readyState === WebSocket.OPEN;
  }

  private shouldBroadcastToClient(entry: SessionEntry): boolean {
    if (!this.isClientConnected(entry.client)) return false;
    if (entry.sidebarVisible) return true;
    return entry.lastBroadcastedStatus !== entry.runtimeStatus;
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
    runtimeStatus: SessionStatus;
  }> {
    return Array.from(this.sessions.entries()).map(([shortId, entry]) => ({
      shortId,
      workingDir: entry.workingDir,
      sessionFile: entry.sessionFile,
      hasClient: this.isClientConnected(entry.client),
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
      runtimeStatus: "idle",
    });

    // Update lookup maps
    this.sessionFileToShortId.set(sessionFile, shortId);

    if (!this.workingDirToShortIds.has(workingDir)) {
      this.workingDirToShortIds.set(workingDir, new Set());
    }
    this.workingDirToShortIds.get(workingDir)?.add(shortId);

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
  updateRuntimeStatus(shortId: string, status: SessionStatus): void {
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
  getRuntimeStatus(shortId: string): SessionStatus | undefined {
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
   * Set which session the client is currently VIEWING
   * Background sessions continue running, only viewing session messages are routed
   *
   * @param client WebSocket client
   * @param shortId Session short ID being viewed
   */
  setViewingSession(client: WebSocket, shortId: string): void {
    this.clientToViewingSession.set(client, shortId);
    console.log(`[ServerSessionManager] Client now viewing session: ${shortId}`);

    // Flush buffered messages for this session to the client
    const entry = this.sessions.get(shortId);
    if (entry?.session) {
      const flushedCount = entry.session.flushMessageBuffer();
      if (flushedCount > 0) {
        console.log(
          `[ServerSessionManager] Flushed ${flushedCount} buffered messages to client for session ${shortId}`
        );
      }

      // 立即广播当前状态，确保客户端看到正确状态
      this.broadcastRuntimeStatus(entry.workingDir);
    }
  }

  /**
   * Get which session the client is currently VIEWING
   *
   * @param client WebSocket client
   * @returns Viewing session short ID or undefined
   */
  getViewingSession(client: WebSocket): string | undefined {
    return this.clientToViewingSession.get(client);
  }

  /**
   * Broadcast runtime status to all clients in a working directory
   *
   * @param workingDir Working directory
   */
  broadcastRuntimeStatus(workingDir: string): void {
    const sessions = this.getSessionsByWorkingDir(workingDir);
    const statusList = sessions.map((entry) => ({
      shortId: entry.shortId,
      status: entry.runtimeStatus,
      hasClient: this.isClientConnected(entry.client),
    }));

    // Send to all clients in this working directory
    sessions.forEach((entry) => {
      if (this.isClientConnected(entry.client)) {
        try {
          entry.client.send(
            JSON.stringify({
              type: "runtime_status_broadcast",
              sessions: statusList,
            })
          );
        } catch (_e) {
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
