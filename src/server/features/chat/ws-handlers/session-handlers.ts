/**
 * Session Handlers
 * Combined handlers for all session-related WebSocket messages
 */

import { existsSync } from "node:fs";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { serverSessionManager, extractShortSessionId } from "../agent-session/session-manager";
import { buildSessionResponse, getAllSessions, getSessionMessages } from "../session-helpers";
import { getLocalSessionsDir } from "../agent-session/utils";
import type { WSContext } from "../ws-router";
import { createHandler, checkPathExists, sendError, sendSuccess, logger } from "./handler-utils";

// ============================================================================
// Init Handler
// ============================================================================

/**
 * Handle init message
 */
export async function handleInit(
  ctx: WSContext,
  payload: {
    workingDir?: string;
    sessionFile?: string;
    messageLimit?: number;
  }
): Promise<void> {
  const { workingDir: clientWorkingDir, sessionFile: clientSessionFile, messageLimit = 100 } = payload;

  // 1. Determine working directory
  const workingDir = clientWorkingDir || process.cwd();

  if (!existsSync(workingDir)) {
    sendError(ctx, `Path does not exist: ${workingDir}`);
    return;
  }

  // 2. Get or create session (ServerSessionManager handles reuse)
  const session = await serverSessionManager.getOrCreateSession(
    workingDir,
    ctx.ws,
    clientSessionFile
  );

  ctx.session = session;

  if (!session.session) {
    throw new Error("Failed to create or get session");
  }

  // 2.5 Set client-selected session (for strict message routing)
  const sessionShortId = extractShortSessionId(session.session?.sessionFile || "");
  if (sessionShortId) {
    serverSessionManager.setClientSelectedSession(ctx.ws, sessionShortId);
    ctx.selectedSessionId = sessionShortId;
    ctx.workingDir = workingDir;
    logger.info(`[handleInit] Client selected session: ${sessionShortId}`);
  }

  // 3. Build response data
  // Pass clientSessionFile to ensure correct session file path
  logger.info(`[handleInit] Building response with sessionFile: ${clientSessionFile || 'none'}`);
  let responseData = await buildSessionResponse(session, workingDir, messageLimit, 10, clientSessionFile);
  logger.info(`[handleInit] Response built: ${responseData.currentSession.messages.length} messages`);

  // 4. If current session has no messages, try loading recent session with messages
  if (responseData.currentSession.messages.length === 0) {
    const allSessions = await getAllSessions(workingDir);
    const recentSessionWithMessages = await findRecentSessionWithMessages(allSessions);

    if (recentSessionWithMessages) {
      logger.info(
        `[handleInit] Switching to session with messages: ${recentSessionWithMessages.path}`
      );
      // Load this session's messages
      const messages = await getSessionMessages(recentSessionWithMessages.path);
      responseData.currentSession.sessionFile = recentSessionWithMessages.path;
      // sessionId should be full path, not short ID
      responseData.currentSession.sessionId = recentSessionWithMessages.path;
      responseData.currentSession.messages = messages;
    }
  }

  // 5. Add short ID to response (unified naming convention)
  const shortId = extractShortSessionId(responseData.currentSession.sessionFile);
  const enhancedResponse = {
    ...responseData,
    currentSession: {
      ...responseData.currentSession,
      shortId,           // 8-character short ID
      sessionFile: responseData.currentSession.sessionFile, // Full path
    },
  };

  // 6. Send response
  sendSuccess(ctx, "initialized", enhancedResponse);

  logger.info(
    `[handleInit] Success: pid=${process.pid}, shortId=${shortId}`
  );
}

/**
 * Find recent session with messages
 */
async function findRecentSessionWithMessages(
  sessions: Awaited<ReturnType<typeof getAllSessions>>
): Promise<{ path: string } | null> {
  const sortedSessions = sessions.sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );

  for (const s of sortedSessions) {
    const msgs = await getSessionMessages(s.path);
    if (msgs.length > 0) {
      return { path: s.path };
    }
  }
  return null;
}

// ============================================================================
// New Session Handler
// ============================================================================

/**
 * Handle new_session message
 */
export async function handleNewSession(
  ctx: WSContext,
  payload: { workingDir?: string }
): Promise<void> {
  const workingDir = payload.workingDir || ctx.session?.workingDir;

  if (!workingDir) {
    sendError(ctx, "Working directory not available");
    return;
  }

  // 1. End current session (force create new) - commented for multi-session coexistence
  // serverSessionManager.endSession(workingDir);
  // logger.info(`[handleNewSession] Ended current session for: ${workingDir}`);

  // 2. Create new session file path (ensure completely new session)
  const { SessionManager } = await import("@mariozechner/pi-coding-agent");
  const { getLocalSessionsDir } = await import("../agent-session/utils");
  const localSessionsDir = getLocalSessionsDir(workingDir);
  const newSessionManager = SessionManager.create(workingDir, localSessionsDir);
  const newSessionFile = newSessionManager.getSessionFile();

  if (!newSessionFile) {
    throw new Error("Failed to create new session file");
  }

  logger.info(`[handleNewSession] Created new session file: ${newSessionFile}`);

  // 3. Initialize session with new session file
  const session = await serverSessionManager.getOrCreateSession(
    workingDir,
    ctx.ws,
    newSessionFile // Explicitly specify new session file
  );

  logger.info(
    `[handleNewSession] Session initialized: ${session.session?.sessionId}, file: ${session.session?.sessionFile}`
  );

  ctx.session = session;

  if (!session.session) {
    throw new Error("Failed to create session");
  }

  // Key: Set client to new session association, else messages buffered
  const shortId = extractShortSessionId(newSessionFile);
  serverSessionManager.setClientSelectedSession(ctx.ws, shortId);
  logger.info(`[handleNewSession] Client associated with new session: ${shortId}`);

  // 4. Use same response builder as init
  // Note: Need to refetch allSessions to include newly created session
  const responseData = await buildSessionResponse(session, workingDir);

  // Verify new session is in list
  const newSessionInList = responseData.allSessions.find((s: any) => s.path === newSessionFile);
  if (!newSessionInList) {
    logger.warn(
      `[handleNewSession] New session ${newSessionFile} not found in allSessions list, adding manually`
    );
    // Manually add to beginning of list
    responseData.allSessions.unshift({
      id: newSessionFile,
      path: newSessionFile,
      name: "New Session",
      messageCount: 0,
      lastModified: new Date().toISOString(),
    });
  }

  // 5. Build response format expected by frontend
  const responsePayload = {
    sessionId: responseData.currentSession.sessionId,
    sessionFile: responseData.currentSession.sessionFile,
    allSessions: responseData.allSessions,
    workingDir: responseData.workingDir,
    currentModel: responseData.currentModel,
    defaultModel: responseData.defaultModel,
  };

  sendSuccess(ctx, "session_created", responsePayload);

  logger.info(`[handleNewSession] Success: sessionId=${session.session.sessionId}, sessionFile=${responseData.currentSession.sessionFile}`);
}

// ============================================================================
// List Sessions Handler
// ============================================================================

/**
 * Handle list_sessions message
 */
// ============================================================================
// Load Session Handler
// ============================================================================

/**
 * Handle load_session message
 */
export async function handleLoadSession(
  ctx: WSContext,
  payload: { sessionPath: string }
): Promise<void> {
  const { sessionPath } = payload;

  try {
    // Use PiAgentSession's loadSession method
    const loadResult = await ctx.session.loadSession(sessionPath);

    if (!loadResult) {
      throw new Error("Failed to load session - no session available");
    }

    if (!loadResult.success) {
      throw new Error(loadResult.error || "Failed to load session");
    }

    // Update client selected session for strict message routing
    const shortId = extractShortSessionId(sessionPath);
    if (shortId) {
      serverSessionManager.setClientSelectedSession(ctx.ws, shortId);
      ctx.selectedSessionId = shortId;
      logger.info(`[handleLoadSession] Client switched to session: ${shortId}`);
    }

    // Build full response with messages using shared helper
    // Pass explicit sessionPath as session.sessionFile may not be updated after switchSession
    const workingDir = ctx.session.workingDir;
    const responseData = await buildSessionResponse(ctx.session, workingDir, 100, 10, sessionPath);

    // Send session_loaded with full message list (unified naming convention)
    sendSuccess(ctx, "session_loaded", {
      success: true,
      shortId,  // 8-character short ID
      sessionFile: responseData.currentSession.sessionFile,  // Full path
      messages: responseData.currentSession.messages,
      totalMessageCount: responseData.currentSession.totalMessageCount,
      cwdChanged: loadResult.cwdChanged,
      newCwd: loadResult.newCwd,
      pid: process.pid,
    });

    logger.info(`[handleLoadSession] Session loaded: ${sessionPath}, messages: ${responseData.currentSession.messages.length}`);
  } catch (error) {
    logger.error("[handleLoadSession] Error:", {}, error instanceof Error ? error : undefined);
    sendSuccess(ctx, "session_loaded", {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load session",
    });
  }
}

// ============================================================================
// Change Directory Handler
// ============================================================================

/**
 * Handle change_dir message
 */
export async function handleChangeDir(
  ctx: WSContext,
  payload: { path: string; currentPath?: string }
): Promise<void> {
  const { path: newPath, currentPath } = payload;

  // Check if path exists
  if (!existsSync(newPath)) {
    sendError(ctx, `Path does not exist: ${newPath}`);
    return;
  }

  // Determine current working directory
  const oldWorkingDir = currentPath || ctx.session?.workingDir || null;

  // Use ServerSessionManager to switch session
  const session = await serverSessionManager.switchSession(
    oldWorkingDir || newPath,
    newPath,
    ctx.ws
  );

  ctx.session = session;

  if (!session.session) {
    throw new Error("Failed to create or get session");
  }

  // Use shared function to build response
  const responseData = await buildSessionResponse(session, newPath);

  sendSuccess(ctx, "dir_changed", responseData);

  logger.info(`[handleChangeDir] Success: sessionId="${session.session.sessionId}"`);
}

// ============================================================================
// List Sessions Handler (WebSocket)
// Replaces HTTP GET /api/sessions
// ============================================================================

/**
 * Handle list_sessions message via WebSocket
 */
export async function handleListSessions(
  ctx: WSContext,
  payload: { workingDir?: string }
): Promise<void> {
  const workingDir = payload.workingDir || ctx.session?.workingDir || process.cwd();

  try {
    const localSessionsDir = getLocalSessionsDir(workingDir);
    const sessions = await SessionManager.list(workingDir, localSessionsDir);

    // Get active sessions status from serverSessionManager
    const activeSessions = serverSessionManager.getAllSessions();
    const activeSessionMap = new Map(
      activeSessions.map(s => [extractShortSessionId(s.sessionFile), s])
    );

    // Build sessions list with safe data access
    const sessionsList = sessions.map((s) => {
      const shortId = extractShortSessionId(s.path);
      const activeInfo = activeSessionMap.get(shortId);
      return {
        id: shortId,
        path: s.path,
        name: s.firstMessage?.slice(0, 35) || s.path?.split("/").pop() || "Untitled",
        messageCount: s.messageCount || 0,
        lastModified: s.modified.toISOString(),
        status: activeInfo?.runtimeStatus || "history",
        hasClient: activeInfo ? activeInfo.hasClient : false,
      };
    });

    sendSuccess(ctx, "sessions_list", { sessions: sessionsList });

    logger.info(`[handleListSessions] Sent ${sessions.length} sessions`);
  } catch (error) {
    logger.error("[handleListSessions] Error:", {}, error instanceof Error ? error : undefined);
    sendError(ctx, error instanceof Error ? error.message : "Failed to list sessions");
  }
}

// ============================================================================
// Get Session Status Handler (WebSocket)
// Replaces HTTP GET /api/sessions/active
// ============================================================================

/**
 * Handle get_session_status message via WebSocket
 */
export async function handleGetSessionStatus(
  ctx: WSContext,
  payload: { sessionId?: string }
): Promise<void> {
  const shortId = payload.sessionId;

  if (!shortId) {
    sendError(ctx, "sessionId is required");
    return;
  }

  try {
    const entry = serverSessionManager.getSessionByShortId(shortId);
  
    if (!entry) {
      sendSuccess(ctx, "session_status", {
        sessionId: shortId,
        status: "idle",
        statusText: "Session not found",
        exists: false,
      });
      return;
    }

    const statusText = {
      idle: "Idle",
      thinking: "Thinking",
      tooling: "Executing Tool",
      streaming: "Streaming",
      waiting: "Waiting for Input",
      error: "Error Occurred",
    }[entry.runtimeStatus] || entry.runtimeStatus;

    sendSuccess(ctx, "session_status", {
      sessionId: shortId,
      status: entry.runtimeStatus,
      statusText,
      exists: true,
      hasClient: entry.client.readyState === WebSocket.OPEN,
      lastActivity: entry.lastActivity.toISOString(),
    });

    logger.info(`[handleGetSessionStatus] Sent status for ${shortId}: ${entry.runtimeStatus}`);
  } catch (error) {
    logger.error("[handleGetSessionStatus] Error:", {}, error instanceof Error ? error : undefined);
    sendError(ctx, error instanceof Error ? error.message : "Failed to get session status");
  }
}

// ============================================================================
// Wrapped Handlers for Registration
// ============================================================================

export const handleInitWrapped = createHandler(handleInit, {
  name: "init",
  requireSession: false,
});

export const handleNewSessionWrapped = createHandler(handleNewSession, {
  name: "new_session",
  requireSession: false,
});

export const handleListSessionsWrapped = createHandler(handleListSessions, {
  name: "list_sessions",
  requireSession: false,
});

export const handleLoadSessionWrapped = createHandler(handleLoadSession, {
  name: "load_session",
  requireSession: true,
});

export const handleChangeDirWrapped = createHandler(handleChangeDir, {
  name: "change_dir",
  requireSession: false,
});

// ============================================================================
// Load More Messages Handler
// ============================================================================

/**
 * Handle load_more_messages message via WebSocket
 * Loads older messages when user scrolls to top
 */
export async function handleLoadMoreMessages(
  ctx: WSContext,
  payload: { sessionFile?: string; offset?: number; limit?: number }
): Promise<void> {
  const { sessionFile, offset = 0, limit = 50 } = payload;

  if (!sessionFile) {
    sendError(ctx, "sessionFile is required");
    return;
  }

  try {
    // Load older messages (going back from the offset)
    const messages = await getSessionMessages(sessionFile, limit, offset);
    const totalCount = await getSessionMessageCount(sessionFile);

    sendSuccess(ctx, "more_messages_loaded", {
      sessionFile,
      messages,
      offset,
      limit,
      totalCount,
      hasMore: offset + messages.length < totalCount,
    });

    logger.info(`[handleLoadMoreMessages] Loaded ${messages.length} messages from offset ${offset} for ${sessionFile}`);
  } catch (error) {
    logger.error("[handleLoadMoreMessages] Error:", {}, error instanceof Error ? error : undefined);
    sendError(ctx, error instanceof Error ? error.message : "Failed to load more messages");
  }
}

export const handleLoadMoreMessagesWrapped = createHandler(handleLoadMoreMessages, {
  name: "load_more_messages",
  requireSession: true,
});

export const handleGetSessionStatusWrapped = createHandler(handleGetSessionStatus, {
  name: "get_session_status",
  requireSession: false,
});

// ============================================================================
// Sidebar Visibility Handler (WebSocket)
// Client notifies server when sidebar is opened/closed
// ============================================================================

/**
 * Handle sidebar_visibility message
 * Used to optimize status broadcasts
 */
export async function handleSidebarVisibility(
  ctx: WSContext,
  payload: { visible?: boolean }
): Promise<void> {
  const isVisible = payload.visible ?? false;
  ctx.sidebarVisible = isVisible;

  // Update session's sidebar visibility
  if (ctx.session?.shortId) {
    serverSessionManager.updateSidebarVisibility(ctx.session.shortId, isVisible);
  }

  logger.info(`[handleSidebarVisibility] Connection ${ctx.connectionId}: sidebar ${isVisible ? "visible" : "hidden"}`);
}

export const handleSidebarVisibilityWrapped = createHandler(handleSidebarVisibility, {
  name: "sidebar_visibility",
  requireSession: false,
});
