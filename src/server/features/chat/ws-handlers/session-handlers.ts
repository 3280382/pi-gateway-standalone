/**
 * Session Handlers — refactored with shared session initialization helper
 */

import { existsSync } from "node:fs";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentConfig } from "@shared/types/agent.types.js";
import { extractShortSessionId, serverSessionManager } from "../session/SessionRegistry.js";
import { getLocalSessionsDir } from "../session/utils.js";
import { sessionConfigManager } from "../session/SessionConfig.js";
import { agentConfigManager } from "../../agents/AgentConfigManager.js";
import {
  buildSessionResponse,
  getAllSessions,
  getSessionMessages,
} from "../session/SessionFile.js";
import type { WSContext } from "../ws-router.js";
import { createHandler, logger, sendError, sendSuccess } from "./handler-utils.js";

// ============================================================================
// Shared: Agent config resolution
// ============================================================================

async function resolveAgentConfig(agentId?: string): Promise<AgentConfig | undefined> {
  if (!agentId) return undefined;
  await agentConfigManager.init();
  const config = agentConfigManager.getAgent(agentId);
  if (config) logger.info(`[session] Agent resolved: ${config.name} (${agentId})`);
  else logger.warn(`[session] Agent not found: ${agentId}`);
  return config;
}

// ============================================================================
// Shared: Session init + response
// ============================================================================

interface SessionInitResult {
  sessionFile: string;
  shortId: string;
  responseData: Awaited<ReturnType<typeof buildSessionResponse>>;
  agentConfig?: AgentConfig;
}

async function initSessionAndBuildResponse(
  ctx: WSContext,
  workingDir: string,
  sessionFile: string | undefined,
  agentConfig: AgentConfig | undefined,
  messageLimit = 100
): Promise<SessionInitResult> {
  const session = await serverSessionManager.getOrCreateSession(
    workingDir,
    ctx.ws,
    sessionFile,
    agentConfig
  );
  ctx.session = session;
  if (!session.session) throw new Error("Failed to create or get session");

  const actualSessionFile = session.session?.sessionFile || "";
  const shortId = extractShortSessionId(actualSessionFile);

  // Set viewing session for message routing
  serverSessionManager.setViewingSession(ctx.ws, shortId);
  ctx.selectedSessionId = shortId;
  ctx.workingDir = workingDir;

  // Save agent config association
  if (agentConfig) {
    await sessionConfigManager.setAgent(
      shortId,
      agentConfig.id,
      agentConfig.name,
      actualSessionFile,
      workingDir
    );
  }

  // Build unified response
  const responseData = await buildSessionResponse(
    session,
    workingDir,
    messageLimit,
    15,
    sessionFile
  );

  return { sessionFile: actualSessionFile, shortId, responseData, agentConfig };
}

// ============================================================================
// Init Handler (page load / directory change)
// ============================================================================

export async function handleInit(
  ctx: WSContext,
  payload: { workingDir?: string; sessionFile?: string; messageLimit?: number; agentId?: string }
): Promise<void> {
  const {
    workingDir: clientWorkingDir,
    sessionFile: clientSessionFile,
    messageLimit = 100,
    agentId,
  } = payload;
  const workingDir = clientWorkingDir;
  if (!workingDir) {
    sendError(ctx, "workingDir is required in init payload");
    return;
  }

  if (!existsSync(workingDir)) {
    sendError(ctx, `Path does not exist: ${workingDir}`);
    return;
  }

  const agentConfig = await resolveAgentConfig(agentId);

  // If agent config provided, force new session file to apply it
  const effectiveSessionFile = agentConfig
    ? SessionManager.create(workingDir, getLocalSessionsDir(workingDir)).getSessionFile()
    : clientSessionFile;

  const { responseData } = await initSessionAndBuildResponse(
    ctx,
    workingDir,
    effectiveSessionFile,
    agentConfig,
    messageLimit
  );

  // Fallback: if no messages, try loading a recent session with messages
  if (responseData.currentSession.messages.length === 0) {
    const allSessions = await getAllSessions(workingDir);
    const sorted = allSessions.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
    for (const s of sorted) {
      const msgs = await getSessionMessages(s.path);
      if (msgs.messages.length > 0) {
        responseData.currentSession.sessionFile = s.path;
        responseData.currentSession.sessionId = s.path;
        responseData.currentSession.messages = msgs.messages;
        responseData.currentSession.processed = true;
        break;
      }
    }
  }

  const shortId = extractShortSessionId(responseData.currentSession.sessionFile);
  sendSuccess(ctx, "initialized", {
    ...responseData,
    currentSession: {
      ...responseData.currentSession,
      shortId,
      sessionFile: responseData.currentSession.sessionFile,
    },
  });
  logger.info(`[handleInit] Success: pid=${process.pid}, shortId=${shortId}`);
}

// ============================================================================
// New Session Handler (Default New / Custom New)
// ============================================================================

export async function handleNewSession(
  ctx: WSContext,
  payload: { workingDir?: string; agentId?: string }
): Promise<void> {
  const workingDir = payload.workingDir || ctx.session?.workingDir;
  if (!workingDir) {
    logger.warn(
      `[handleNewSession] No workingDir — payload.workingDir=${payload.workingDir} ctx.session?.workingDir=${ctx.session?.workingDir}`
    );
    sendError(ctx, "Working directory not available");
    return;
  }

  const agentConfig = await resolveAgentConfig(payload.agentId);

  // Always create a fresh session file
  const newSessionFile = SessionManager.create(
    workingDir,
    getLocalSessionsDir(workingDir)
  ).getSessionFile();
  if (!newSessionFile) throw new Error("Failed to create new session file");

  const { responseData } = await initSessionAndBuildResponse(
    ctx,
    workingDir,
    newSessionFile,
    agentConfig
  );

  // Ensure new session is in the list
  if (!responseData.allSessions.find((s: any) => s.path === newSessionFile)) {
    responseData.allSessions.unshift({
      id: newSessionFile,
      path: newSessionFile,
      name: "New Session",
      messageCount: 0,
      lastModified: new Date().toISOString(),
    });
  }

  sendSuccess(ctx, "session_created", {
    sessionId: responseData.currentSession.sessionId,
    sessionFile: responseData.currentSession.sessionFile,
    allSessions: responseData.allSessions,
    workingDir: responseData.workingDir,
    currentModel: responseData.currentModel,
    defaultModel: responseData.defaultModel,
  });

  logger.info(`[handleNewSession] Success: file=${responseData.currentSession.sessionFile}`);
}

// ============================================================================
// List Sessions Handler
// ============================================================================

export async function handleListSessions(
  ctx: WSContext,
  payload: { workingDir?: string }
): Promise<void> {
  const workingDir = payload.workingDir || ctx.session?.workingDir || process.cwd();
  try {
    const localSessionsDir = getLocalSessionsDir(workingDir);
    const sessions = await SessionManager.list(workingDir, localSessionsDir);
    const activeSessions = serverSessionManager.getAllSessions();
    const activeSessionMap = new Map(
      activeSessions.map((s) => [extractShortSessionId(s.sessionFile), s])
    );

    const sortedSessions = sessions
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      .slice(0, 15);

    const sessionIds = sortedSessions.map((s) => ({
      id: extractShortSessionId(s.path),
      path: s.path,
    }));
    await sessionConfigManager.ensureConfigs(sessionIds, workingDir);
    const configs = sessionConfigManager.getAllConfigs(workingDir);

    const sessionsList = sortedSessions.map((s) => {
      const shortId = extractShortSessionId(s.path);
      const activeInfo = activeSessionMap.get(shortId);
      const config = configs[shortId];
      return {
        id: shortId,
        path: s.path,
        name:
          s.firstMessage?.slice(0, 35) || config?.name || s.path?.split("/").pop() || "Untitled",
        messageCount: s.messageCount || 0,
        lastModified: s.modified.toISOString(),
        status: activeInfo?.runtimeStatus || "history",
        hasClient: activeInfo ? activeInfo.hasClient : false,
        agentId: config?.agentId || null,
        agentName: config?.agentName || null,
      };
    });

    sendSuccess(ctx, "sessions_list", { sessions: sessionsList });
    logger.info(`[handleListSessions] Sent ${sessionsList.length} sessions`);
  } catch (error) {
    logger.error("[handleListSessions] Error:", {}, error instanceof Error ? error : undefined);
    sendError(ctx, error instanceof Error ? error.message : "Failed to list sessions");
  }
}

// ============================================================================
// Update Session Config Handler
// ============================================================================

export async function handleUpdateSessionConfig(
  ctx: WSContext,
  payload: { sessionId: string; name?: string }
): Promise<void> {
  const { sessionId, name } = payload;
  if (!sessionId) {
    sendError(ctx, "sessionId is required");
    return;
  }
  try {
    if (name !== undefined) await sessionConfigManager.updateName(sessionId, name, ctx.workingDir);
    const workingDir = ctx.workingDir || process.cwd();
    const sessions = await getAllSessions(workingDir, 15);
    serverSessionManager.broadcastToWorkingDir(workingDir, { type: "sessions_list", sessions });
  } catch (error) {
    sendError(ctx, error instanceof Error ? error.message : "Failed to update session config");
  }
}

// ============================================================================
// Delete Session Handler
// ============================================================================

export async function handleDeleteSession(
  ctx: WSContext,
  payload: { sessionId: string }
): Promise<void> {
  const { sessionId } = payload;
  if (!sessionId) {
    sendError(ctx, "sessionId is required");
    return;
  }
  try {
    const workingDir = ctx.workingDir || process.cwd();
    const config = sessionConfigManager.getConfig(sessionId);
    if (!config) {
      sendError(ctx, `Session ${sessionId} not found`);
      return;
    }

    const { fullPath } = config;

    // 1. Stop running agent and dispose from memory before deleting files
    const entry = serverSessionManager.getSessionByShortId(sessionId);
    if (entry) {
      // Abort any active LLM call first, then dispose
      await entry.session.abort().catch(() => {});
      serverSessionManager.endSession(sessionId);
    }

    // 2. Delete session JSONL file
    if (fullPath && existsSync(fullPath)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(fullPath);
    }

    // 3. Delete associated log file
    if (fullPath) {
      const logPath = fullPath.replace(/\.jsonl$/, ".log");
      if (existsSync(logPath)) {
        const { unlink } = await import("node:fs/promises");
        await unlink(logPath);
      }
    }

    // 4. Remove from session-config.json
    await sessionConfigManager.removeConfig(sessionId, workingDir);

    // 5. Broadcast updated session list
    const sessions = await getAllSessions(workingDir, 15);
    serverSessionManager.broadcastToWorkingDir(workingDir, { type: "sessions_list", sessions });

    sendSuccess(ctx, "session_deleted", { sessionId });
    logger.info(`[handleDeleteSession] Deleted session ${sessionId}, file=${fullPath}`);
  } catch (error) {
    logger.error("[handleDeleteSession] Error:", {}, error instanceof Error ? error : undefined);
    sendError(ctx, error instanceof Error ? error.message : "Failed to delete session");
  }
}

// ============================================================================
// Sidebar Visibility Handler
// ============================================================================

export async function handleSidebarVisibility(
  ctx: WSContext,
  payload: { visible?: boolean }
): Promise<void> {
  const isVisible = payload.visible ?? false;
  ctx.sidebarVisible = isVisible;
  if (ctx.session?.shortId)
    serverSessionManager.updateSidebarVisibility(ctx.session.shortId, isVisible);
}

// ============================================================================
// Get Session Info Handler (live runtime state)
// ============================================================================

export async function handleGetSessionInfo(ctx: WSContext, _payload: unknown): Promise<void> {
  try {
    const info = ctx.session.getSessionInfo();
    const resourceFiles = info.resourceFiles as any;

    // Also check session config for agent name (fallback)
    let agentName = (info.agentName as string) || null;
    let agentId = (info.agentId as string) || null;
    if (!agentName && ctx.selectedSessionId) {
      try {
        const config = await sessionConfigManager.getConfig(ctx.selectedSessionId);
        if (config?.agentName) {
          agentName = config.agentName;
          agentId = config.agentId || null;
        }
      } catch {
        /* ignore */
      }
    }

    sendSuccess(ctx, "session_info", {
      systemPrompt: info.systemPrompt || "(no system prompt)",
      model: info.model || null,
      thinkingLevel: info.thinkingLevel || null,
      tools: info.tools || [],
      skills: resourceFiles?.skills?.loaded || [],
      agentsFiles:
        resourceFiles?.agentsFiles?.map((f: any) => ({ path: f.path, content: f.content || "" })) ||
        [],
      agentName,
      agentId,
      workingDir: info.workingDir,
      sessionFile: info.sessionFile,
      isLive: true,
    });
  } catch (error) {
    sendError(ctx, error instanceof Error ? error.message : "Failed to get session info");
  }
}

// ============================================================================
// Wrapped Handlers for Registration
// ============================================================================

export const handleInitWrapped = createHandler(handleInit, { name: "init", requireSession: false });
export const handleNewSessionWrapped = createHandler(handleNewSession, {
  name: "new_session",
  requireSession: false,
});
export const handleListSessionsWrapped = createHandler(handleListSessions, {
  name: "list_sessions",
  requireSession: false,
});
export const handleUpdateSessionConfigWrapped = createHandler(handleUpdateSessionConfig, {
  name: "update_session_config",
  requireSession: false,
});
export const handleDeleteSessionWrapped = createHandler(handleDeleteSession, {
  name: "delete_session",
  requireSession: false,
});
export const handleSidebarVisibilityWrapped = createHandler(handleSidebarVisibility, {
  name: "sidebar_visibility",
  requireSession: false,
});
export const handleGetSessionInfoWrapped = createHandler(handleGetSessionInfo, {
  name: "get_session_info",
  requireSession: true,
});
