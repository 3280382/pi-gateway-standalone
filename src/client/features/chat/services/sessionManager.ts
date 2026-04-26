/**
 * Session Manager - 统一会话管理模块
 *
 * Responsibilities:
 * 1. 封装 session 生命周期管理（切换directories、选择 session、恢复 session）
 * 2. 协调 sidebarStore、sessionStore、workspaceStore、chatStore 的更新
 * 3. 所有操作使用统一的 initChatWorkingDirectory API
 *
 * 统一原则：
 * - 所有场景（RefreshPages面、切换directories、选择 session）都使用 initChatWorkingDirectory
 * - 都更新相同的 store 字段
 *
 * 性能优化：
 * - 服务器已预处理所有消息，客户端直接使用，无需再调用 normalizeSessionMessages
 */

import { initChatWorkingDirectory } from "@/features/chat/services/chatWebSocket";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Message } from "@/features/chat/types/chat";
import type { Session } from "@/features/chat/types/sidebar";
import { extractShortSessionId } from "@shared/utils/extractShortSessionId";
import { websocketService } from "@/services/websocket.service";
import { useWorkspaceStore as useGlobalWorkspaceStore } from "@/stores/workspaceStore";
import { createNewChatSession } from "./chatWebSocket";

// ============================================================================
// Types
// ============================================================================

export interface SwitchDirOptions {
  clearSessions?: boolean;
}

export interface SessionManagerAPI {
  switchDirectory: (dir: string, options?: SwitchDirOptions) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  createNewSession: (workingDir?: string, agentId?: string, sessionName?: string) => Promise<void>;
}

// ============================================================================
// Private Helpers
// ============================================================================

function extractSessionId(pathOrId: string | undefined): string {
  if (!pathOrId) return "";
  if (pathOrId.includes("/")) {
    return extractShortSessionId(pathOrId);
  }
  return pathOrId.slice(-8);
}

function findSessionInList(sessions: Session[], sessionId: string): Session | undefined {
  const normalizedId = extractSessionId(sessionId);
  return sessions.find(
    (s) =>
      s.id === sessionId ||
      s.path.includes(normalizedId) ||
      extractSessionId(s.path) === normalizedId
  );
}

function getStores() {
  return {
    sidebar: useSidebarStore.getState(),
    session: useSessionStore.getState(),
    globalWorkspace: useGlobalWorkspaceStore.getState(),
    chat: useChatStore.getState(),
  };
}

// 导出辅助函数供其他模块使用
export { getStores, updateSessionsAndStatus };

// ============================================================================
// Unified Helpers
// ============================================================================

/**
 * 统一更新 sessions 列表和运行时状态
 * 所有场景使用相同的逻辑：setSessions + updateRuntimeStatusBulk
 */
function updateSessionsAndStatus(
  sidebarStore: ReturnType<typeof getStores>["sidebar"],
  sessions: any[]
) {
  if (!sessions || sessions.length === 0) return;

  // 更新 sessions 列表
  sidebarStore.setSessions(sessions);

  // 提取并更新运行时状态
  const statusList = sessions
    .filter((s: any) => s?.id && s.status)
    .map((s: any) => ({
      sessionId: s.id,
      status: s.status,
    }));

  if (statusList.length > 0) {
    sidebarStore.updateRuntimeStatusBulk(statusList);
  }
}

/**
 * 统一处理 init 响应
 * 所有场景（Refresh、切换directories、选择 session）使用相同的处理逻辑
 */
async function handleInitResponse(response: any, stores: ReturnType<typeof getStores>) {
  console.log("HANDLEINITRESPONSE CALLED!", {
    hasResponse: !!response,
    hasCurrentSession: !!response?.currentSession,
    hasChat: !!stores.chat,
    messagesCount: response?.currentSession?.messages?.length,
  });
  const { pid, workingDir, currentSession, allSessions, currentModel, allModels, thinkingLevel } =
    response;

  // 1. 更新工作directories（同时传入最近 sessionFile）
  const sessionFile = currentSession?.sessionFile;
  stores.globalWorkspace.setCurrentPath(workingDir, sessionFile);
  stores.sidebar.setWorkingDir(workingDir);
  stores.session.setWorkingDir(workingDir);

  // 2. 更新连接状态和服务器信息
  stores.session.setIsConnected(true);
  stores.session.setServerPid(pid);
  stores.session.setCurrentModel(currentModel);
  stores.session.setThinkingLevel(thinkingLevel as any);
  stores.session.setAvailableModels(allModels || []);

  // 3. 更新 sessions 列表和状态（统一使用辅助函数）
  updateSessionsAndStatus(stores.sidebar, allSessions || []);

  // 使用服务器返回的短 ID 作为选中 session ID
  const shortSessionId = (currentSession as any)?.shortId || null;
  stores.sidebar.setSelectedSessionId(shortSessionId);

  // 4. 更新当前 session
  stores.session.setCurrentSession(shortSessionId);
  stores.session.setCurrentSessionFile(currentSession?.sessionFile || null);

  // 5. 加载消息（使用统一的消息转换）
  console.log("[handleInitResponse] currentSession:", {
    sessionFile: currentSession?.sessionFile,
    shortId: currentSession?.shortId,
    messageCount: currentSession?.messages?.length,
    hasMessages: !!currentSession?.messages,
    processed: currentSession?.processed,
  });
  if (currentSession?.messages?.length > 0) {
    console.log("LOADING MESSAGES:", currentSession.messages.length);

    // 使用服务器预处理的消息（服务器已处理所有消息格式转换）
    const formattedMessages: Message[] = currentSession.messages;

    console.log("FORMATTED MESSAGES:", formattedMessages.length);
    console.log("ABOUT TO CALL SETMESSAGES...");
    console.log("stores.chat object:", stores.chat);
    console.log("stores.chat.setMessages:", stores.chat?.setMessages);
    try {
      stores.chat.setMessages(formattedMessages);
      console.log("SETMESSAGES CALLED SUCCESSFULLY!");
    } catch (e) {
      console.error("SETMESSAGES FAILED:", e);
    }
    console.log("NEW MESSAGES COUNT:", stores.chat.messages?.length);
  } else {
    console.log("NO MESSAGES TO LOAD");
    stores.chat.setMessages([]);
  }

  // 6. 清理流式状态和运Rows状态
  stores.chat.abortStreaming();
  stores.chat.setIsRunning(false);
  stores.chat.clearInput();
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * 切换工作directories
 * 使用与RefreshPages面完全相同的 initChatWorkingDirectory API
 * 使用覆盖式 loading，不Clear界面直到服务器返回
 */
async function switchDirectory(targetDir: string, _options: SwitchDirOptions = {}): Promise<void> {
  const stores = getStores();

  console.log("[SessionManager.switchDirectory] targetDir=", targetDir);

  // 从 recentWorkspaces 获取该 workspace 最近使用的 sessionFile
  const recentWorkspace = stores.globalWorkspace.recentWorkspaces.find((w) => w.path === targetDir);
  const sessionFile =
    recentWorkspace?.lastSessionFile ?? stores.globalWorkspace.getSessionFile(targetDir);
  console.log("[SessionManager.switchDirectory] sessionFile for", targetDir, ":", sessionFile);

  // 设置加载状态（覆盖式，不Clear界面）
  stores.sidebar.setLoading(true);
  console.log("[SessionManager.switchDirectory] 显示 loading");

  try {
    // 使用统一的 init API，传入该 workspace 的 sessionFile 用于精确恢复
    const messageLimit = stores.globalWorkspace.defaultMessageLimit;
    const response = await initChatWorkingDirectory(targetDir, sessionFile, 15000, messageLimit);

    console.log("[SessionManager.switchDirectory] 服务器返回:", {
      workingDir: response.workingDir,
      allSessionsCount: response.allSessions?.length,
    });

    // 重建界面（更新所有状态，包括 setCurrentPath 和 setSessionFile）
    await handleInitResponse(response, stores);

    console.log("[SessionManager.switchDirectory] 界面重建完成");
  } catch (error) {
    console.error("[SessionManager.switchDirectory] error:", error);
    // 降级：至少更新工作目录
    stores.globalWorkspace.setCurrentPath(targetDir);
    stores.sidebar.setWorkingDir(targetDir);
    stores.session.setWorkingDir(targetDir);
    throw error;
  } finally {
    // 结束 loading
    stores.sidebar.setLoading(false);
    console.log("[SessionManager.switchDirectory] loading 结束");
  }
}

/**
 * 选择指定 session
 * 使用与RefreshPages面完全相同的 initChatWorkingDirectory API
 * 使用覆盖式 loading，不Clear界面直到服务器返回
 */
async function selectSession(sessionId: string): Promise<void> {
  console.log("SELECTSESSION STARTED:", sessionId);
  const stores = getStores();
  console.log("STORES:", {
    hasChat: !!stores.chat,
    hasSetMessages: typeof stores.chat?.setMessages === "function",
    chatMessages: stores.chat?.messages?.length,
  });
  const session = findSessionInList(stores.sidebar.sessions, sessionId);

  if (!session) {
    console.warn("[SessionManager.selectSession] session not found:", sessionId);
    return;
  }

  // 如果点击的是当前已选中的 session，直接返回
  const currentSelectedId = stores.sidebar.selectedSessionId;
  // 统一使用短ID进Rows比较
  const currentShortId = extractShortSessionId(currentSelectedId || "");
  const targetShortId = extractShortSessionId(session.path);
  console.log("CHECKING SELECTED:", {
    currentSelectedId,
    currentShortId,
    targetShortId,
    sessionPath: session.path,
    equal: currentShortId === targetShortId,
  });
  if (currentShortId && currentShortId === targetShortId) {
    console.log("[SessionManager.selectSession] already selected, skipping");
    return;
  }

  console.log("[SessionManager.selectSession] sessionId=", sessionId);

  // 【乐观更新】先立即更新 UI 为选中状态，让用户看到反馈
  const shortId = extractShortSessionId(session.path);
  const previousSelectedId = stores.sidebar.selectedSessionId;
  stores.sidebar.setSelectedSessionId(shortId);
  console.log("[SessionManager.selectSession] 乐观更新 UI 为选中状态:", shortId);

  // 【UX优化】不显示全局loading，只在Sessions标题后显示小指示器
  // workspace 部分保持正常显示，不受loading影响

  try {
    // 使用统一的 init API（传入 sessionFile 用于Exact match）
    console.log("[SessionManager.selectSession] Calling initChatWorkingDirectory...");
    const messageLimit = stores.globalWorkspace.defaultMessageLimit;
    const response = await initChatWorkingDirectory(
      stores.session.workingDir,
      session.path,
      15000,
      messageLimit
    );
    console.log("[SessionManager.selectSession] initChatWorkingDirectory returned!");

    console.log("[SessionManager.selectSession] 服务器返回:", {
      hasCurrentSession: !!response.currentSession,
      currentSessionKeys: response.currentSession ? Object.keys(response.currentSession) : [],
      sessionFile: response.currentSession?.sessionFile,
      shortId: response.currentSession?.shortId,
      messageCount: response.currentSession?.messages?.length,
      firstMessage: response.currentSession?.messages?.[0],
    });

    // 重建界面（更新所有状态，包括 setCurrentPath 和 setSessionFile）
    console.log("[SessionManager.selectSession] 调用 handleInitResponse, stores.chat:", {
      hasSetMessages: typeof stores.chat?.setMessages === "function",
    });
    await handleInitResponse(response, stores);

    console.log("[SessionManager.selectSession] 界面重建完成");
  } catch (error) {
    console.error("[SessionManager.selectSession] error:", error);
    // 【错误回滚】恢复之前的选中状态
    stores.sidebar.setSelectedSessionId(previousSelectedId);
    console.log("[SessionManager.selectSession] 错误回滚，恢复选中状态:", previousSelectedId);
    throw error;
  }
}

/**
 * 创建新 session
 * 轻量级实现：只添加新 session 到Cols表并选中，不重建整个界面
 * 使用覆盖式 loading，不Clear界面直到服务器返回
 */
async function createNewSession(
  workingDir?: string,
  agentId?: string,
  sessionName?: string
): Promise<void> {
  const stores = getStores();

  const targetWorkingDir = workingDir || stores.session.workingDir;

  // 设置加载状态（覆盖式，不Clear界面）
  stores.sidebar.setLoading(true);
  console.log("[SessionManager.createNewSession] 开始创建，显示 loading", {
    workingDir: targetWorkingDir,
    agentId,
  });

  try {
    // 1. 发送创建请求，等待服务器返回新 session 信息
    const createResponse = await new Promise<{
      sessionId: string;
      sessionFile: string;
      allSessions?: any[];
    }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("创建 session 超时")), 10000);

      createNewChatSession(targetWorkingDir, agentId);

      const unsub = websocketService.on("session_created", (data: any) => {
        clearTimeout(timeout);
        unsub();
        resolve(data);
      });
    });

    console.log("[SessionManager.createNewSession] 服务器返回:", {
      sessionId: createResponse.sessionId,
      sessionFile: createResponse.sessionFile,
    });

    // 2. 构建新 session 对象（使用短 ID）
    const shortId = extractShortSessionId(createResponse.sessionFile);
    const newSession: Session = {
      id: shortId,
      path: createResponse.sessionFile,
      name: "New Session",
      messageCount: 0,
      lastModified: new Date(),
    };

    // 3. 添加到 session Cols表最前面（避免重复）
    const existingSessions = stores.sidebar.sessions;
    const filteredSessions = existingSessions.filter((s) => s.path !== newSession.path);
    const updatedSessions = [newSession, ...filteredSessions];

    stores.sidebar.setSessions(updatedSessions);
    console.log("[SessionManager.createNewSession] 已添加到Cols表:", newSession.path);

    // 4. 选中新 session 并设置名称
    stores.sidebar.setSelectedSessionId(newSession.id);
    stores.session.setCurrentSession(newSession.id);
    stores.session.setCurrentSessionFile(newSession.path);
    console.log("[SessionManager.createNewSession] 已选中:", newSession.id);

    // 4.5 如果有自定义名称，通过 WebSocket 更新
    if (sessionName) {
      const { updateSessionName } = await import("@/features/chat/services/api/sessionConfigApi");
      updateSessionName(newSession.id, sessionName);
      console.log("[SessionManager.createNewSession] Set name:", sessionName);
    }

    // 5. Clear聊天消息区域并重置所有状态（新 session 从干净状态开始）
    stores.chat.setMessages([]);
    stores.chat.abortStreaming();
    stores.chat.setIsRunning(false);
    stores.chat.clearInput();
    console.log("[SessionManager.createNewSession] 已Clear消息区域并Reset state");

    // 6. 如果服务端返回了完整Cols表，使用服务端的（确保同步）
    if (createResponse.allSessions && createResponse.allSessions.length > 0) {
      const serverSessions = createResponse.allSessions.map((s: any) => ({
        id: s.path || s.id,
        path: s.path || s.id,
        name: s.firstMessage?.split("\n")[0].trim().slice(0, 30) || s.name || "Untitled",
        messageCount: s.messageCount || 0,
        lastModified: s.modified || s.lastModified || new Date().toISOString(),
      }));
      stores.sidebar.setSessions(serverSessions);
      console.log("[SessionManager.createNewSession] 已同步服务端Cols表:", serverSessions.length);
    }

    console.log("[SessionManager.createNewSession] 完成");
  } catch (error) {
    console.error("[SessionManager.createNewSession] Error:", error);
    throw error;
  } finally {
    // 结束 loading
    stores.sidebar.setLoading(false);
    console.log("[SessionManager.createNewSession] loading 结束");
  }
}

// ============================================================================
// Public API
// ============================================================================

export const sessionManager: SessionManagerAPI = {
  switchDirectory,
  selectSession,
  createNewSession,
};

// Debug: mount to window for testing
console.log("[SessionManager] Module loaded, typeof window:", typeof window);
if (typeof window !== "undefined") {
  (window as any).sessionManager = sessionManager;
  console.log("[SessionManager] Mounted to window.sessionManager");
}

export function useSessionManager(): SessionManagerAPI {
  return sessionManager;
}
