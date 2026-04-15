/**
 * Session Handlers
 * Combined handlers for all session-related WebSocket messages
 */

import { existsSync } from "node:fs";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { serverSessionManager } from "../agent-session/session-manager";
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
  }
): Promise<void> {
  const { workingDir: clientWorkingDir, sessionFile: clientSessionFile } = payload;

  // 1. 确定工作目录
  const workingDir = clientWorkingDir || process.cwd();

  if (!existsSync(workingDir)) {
    sendError(ctx, `Path does not exist: ${workingDir}`);
    return;
  }

  // 2. 获取或创建 session（ServerSessionManager 处理复用逻辑）
  const session = await serverSessionManager.getOrCreateSession(
    workingDir,
    ctx.ws,
    clientSessionFile
  );

  ctx.session = session;

  if (!session.session) {
    throw new Error("Failed to create or get session");
  }

  // 3. 构建响应数据
  let responseData = await buildSessionResponse(session, workingDir);

  // 4. 如果当前 session 没有消息，尝试加载最近的有消息的 session
  if (responseData.currentSession.messages.length === 0) {
    const allSessions = await getAllSessions(workingDir);
    const recentSessionWithMessages = await findRecentSessionWithMessages(allSessions);

    if (recentSessionWithMessages) {
      logger.info(
        `[handleInit] Switching to session with messages: ${recentSessionWithMessages.path}`
      );
      // 加载该 session 的消息
      const messages = await getSessionMessages(recentSessionWithMessages.path);
      responseData.currentSession.sessionFile = recentSessionWithMessages.path;
      // sessionId 应该是完整路径，不是短ID
      responseData.currentSession.sessionId = recentSessionWithMessages.path;
      responseData.currentSession.messages = messages;
    }
  }

  // 5. 发送响应
  sendSuccess(ctx, "initialized", responseData);

  logger.info(
    `[handleInit] Success: pid=${process.pid}, sessionId=${responseData.currentSession.sessionId}`
  );
}

/**
 * 查找最近的有消息的 session
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

  // 1. 结束当前 session（强制创建新的）
  serverSessionManager.endSession(workingDir);
  logger.info(`[handleNewSession] Ended current session for: ${workingDir}`);

  // 2. 创建新的 session 文件路径（确保是全新的session）
  const { SessionManager } = await import("@mariozechner/pi-coding-agent");
  const { getLocalSessionsDir } = await import("../agent-session/utils");
  const localSessionsDir = getLocalSessionsDir(workingDir);
  const newSessionManager = SessionManager.create(workingDir, localSessionsDir);
  const newSessionFile = newSessionManager.getSessionFile();

  if (!newSessionFile) {
    throw new Error("Failed to create new session file");
  }

  logger.info(`[handleNewSession] Created new session file: ${newSessionFile}`);

  // 3. 使用新创建的 session 文件初始化 session
  const session = await serverSessionManager.getOrCreateSession(
    workingDir,
    ctx.ws,
    newSessionFile // 明确指定新创建的 session 文件
  );

  logger.info(
    `[handleNewSession] Session initialized: ${session.session?.sessionId}, file: ${session.session?.sessionFile}`
  );

  ctx.session = session;

  if (!session.session) {
    throw new Error("Failed to create session");
  }

  // 4. 使用与 init 相同的响应构建函数
  // 注意：需要重新获取allSessions，确保包含新创建的session
  const responseData = await buildSessionResponse(session, workingDir);

  // 验证新session是否在列表中
  const newSessionInList = responseData.allSessions.find((s: any) => s.path === newSessionFile);
  if (!newSessionInList) {
    logger.warn(
      `[handleNewSession] New session ${newSessionFile} not found in allSessions list, adding manually`
    );
    // 手动添加到列表开头
    responseData.allSessions.unshift({
      id: newSessionFile,
      path: newSessionFile,
      name: "New Session",
      messageCount: 0,
      lastModified: new Date().toISOString(),
    });
  }

  // 5. 发送响应（使用与 init 相同的格式，但 type 不同）
  sendSuccess(ctx, "session_created", responseData);

  logger.info(`[handleNewSession] Success: sessionId=${session.session.sessionId}`);
}

// ============================================================================
// List Sessions Handler
// ============================================================================

/**
 * Handle list_sessions message
 */
export async function handleListSessions(ctx: WSContext, payload: { cwd: string }): Promise<void> {
  const { cwd } = payload;

  try {
    const localSessionsDir = getLocalSessionsDir(cwd);
    const sessions = await SessionManager.list(cwd, localSessionsDir);

    sendSuccess(ctx, "sessions_list", {
      sessions: sessions.map((s) => ({
        id: s.id,
        path: s.path,
        firstMessage: s.firstMessage,
        messageCount: s.messageCount,
        cwd: s.cwd,
        modified: s.modified.toISOString(),
      })),
    });

    logger.info(`[handleListSessions] Sent ${sessions.length} sessions`);
  } catch (error) {
    logger.error("[handleListSessions] Error:", {}, error instanceof Error ? error : undefined);
    sendError(ctx, error instanceof Error ? error.message : "Failed to list sessions");
  }
}

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
    await ctx.session.loadSession(sessionPath);
    // loadSession already sends response internally
    logger.info(`[handleLoadSession] Session loaded: ${sessionPath}`);
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

  // 检查路径是否存在
  if (!existsSync(newPath)) {
    sendError(ctx, `Path does not exist: ${newPath}`);
    return;
  }

  // 确定当前工作目录
  const oldWorkingDir = currentPath || ctx.session?.workingDir || null;

  // 使用 ServerSessionManager 切换 session
  const session = await serverSessionManager.switchSession(
    oldWorkingDir || newPath,
    newPath,
    ctx.ws
  );

  ctx.session = session;

  if (!session.session) {
    throw new Error("Failed to create or get session");
  }

  // 使用共享函数构建响应
  const responseData = await buildSessionResponse(session, newPath);

  sendSuccess(ctx, "dir_changed", responseData);

  logger.info(`[handleChangeDir] Success: sessionId="${session.session.sessionId}"`);
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
