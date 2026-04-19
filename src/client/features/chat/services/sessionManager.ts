/**
 * Session Manager - 统一会话管理模块
 *
 * 职责：
 * 1. 封装 session 生命周期管理（切换目录、选择 session、恢复 session）
 * 2. 协调 sidebarStore、sessionStore、workspaceStore、chatStore 的更新
 * 3. 所有操作使用统一的 initChatWorkingDirectory API
 *
 * 统一原则：
 * - 所有场景（刷新页面、切换目录、选择 session）都使用 initChatWorkingDirectory
 * - 都使用 normalizeSessionMessages 处理消息
 * - 都更新相同的 store 字段
 */

import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import { websocketService } from "@/services/websocket.service";
import { initChatWorkingDirectory } from "@/features/chat/services/chatWebSocket";
import { extractShortSessionId } from "@/features/chat/utils/sessionUtils";
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
  createNewSession: () => Promise<void>;
}

// ============================================================================
// Private Helpers
// ============================================================================

function extractSessionId(pathOrId: string | undefined): string {
  if (!pathOrId) return "";
  if (pathOrId.includes("/")) {
    const fileName = pathOrId.split("/").pop() || "";
    return fileName.replace(".jsonl", "").split("_").pop() || pathOrId;
  }
  return pathOrId;
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

// ============================================================================
// Unified Response Handler
// ============================================================================

/**
 * 统一处理 init 响应
 * 所有场景（刷新、切换目录、选择 session）使用相同的处理逻辑
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

  // 1. 更新工作目录
  stores.globalWorkspace.setWorkingDir(workingDir);
  stores.sidebar.setWorkingDir(workingDir);
  stores.session.setWorkingDir(workingDir);

  // 2. 更新连接状态和服务器信息
  stores.session.setIsConnected(true);
  stores.session.setServerPid(pid);
  stores.session.setCurrentModel(currentModel);
  stores.session.setThinkingLevel(thinkingLevel as any);
  stores.session.setAvailableModels(allModels || []);

  // 3. 更新 sessions 列表
  stores.sidebar.setSessions(allSessions || []);
  // 使用服务器返回的短 ID 作为选中 session ID（确保与 sidebar 中的 session.id 一致）
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
  });
  if (currentSession?.messages?.length > 0) {
    console.log("LOADING MESSAGES:", currentSession.messages.length);
    const { normalizeSessionMessages } = await import("@/features/chat/utils/messageUtils");
    const formattedMessages = normalizeSessionMessages(currentSession.messages);
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

  // 6. 清理流式状态和运行状态（完全切换到新 session）
  stores.chat.abortStreaming();
  stores.chat.setIsRunning(false);
  // 清空输入框，确保新 session 从干净状态开始
  stores.chat.clearInput();
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * 切换工作目录
 * 使用与刷新页面完全相同的 initChatWorkingDirectory API
 * 使用覆盖式 loading，不清空界面直到服务器返回
 */
async function switchDirectory(targetDir: string, options: SwitchDirOptions = {}): Promise<void> {
  const stores = getStores();

  console.log("[SessionManager.switchDirectory] targetDir=", targetDir);

  // 设置加载状态（覆盖式，不清空界面）
  stores.sidebar.setLoading(true);
  console.log("[SessionManager.switchDirectory] 显示 loading");

  try {
    // 使用统一的 init API（不传 sessionFile，让服务器选择新目录的默认 session）
    const messageLimit = stores.session.defaultMessageLimit;
    const response = await initChatWorkingDirectory(targetDir, undefined, 15000, messageLimit);

    console.log("[SessionManager.switchDirectory] 服务器返回:", {
      workingDir: response.workingDir,
      allSessionsCount: response.allSessions?.length,
    });

    // 重建界面（更新所有状态）
    await handleInitResponse(response, stores);

    console.log("[SessionManager.switchDirectory] 界面重建完成");
  } catch (error) {
    console.error("[SessionManager.switchDirectory] error:", error);
    // 降级：至少更新工作目录
    stores.globalWorkspace.setWorkingDir(targetDir);
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
 * 使用与刷新页面完全相同的 initChatWorkingDirectory API
 * 使用覆盖式 loading，不清空界面直到服务器返回
 */
async function selectSession(sessionId: string): Promise<void> {
  console.log("SELECTSESSION STARTED:", sessionId);
  const stores = getStores();
  console.log("STORES:", {
    hasChat: !!stores.chat,
    hasSetMessages: typeof stores.chat?.setMessages === 'function',
    chatMessages: stores.chat?.messages?.length,
  });
  const session = findSessionInList(stores.sidebar.sessions, sessionId);

  if (!session) {
    console.warn("[SessionManager.selectSession] session not found:", sessionId);
    return;
  }

  // 如果点击的是当前已选中的 session，直接返回
  const currentSelectedId = stores.sidebar.selectedSessionId;
  // 统一使用短ID进行比较
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

  // 设置加载状态（覆盖式，不清空界面）
  stores.sidebar.setLoading(true);
  console.log("[SessionManager.selectSession] 显示 loading");

  try {
    // 使用统一的 init API（传入 sessionFile 用于精确匹配）
    console.log("[SessionManager.selectSession] Calling initChatWorkingDirectory...");
    const messageLimit = stores.session.defaultMessageLimit;
    const response = await initChatWorkingDirectory(stores.session.workingDir, session.path, 15000, messageLimit);
    console.log("[SessionManager.selectSession] initChatWorkingDirectory returned!");

    console.log("[SessionManager.selectSession] 服务器返回:", {
      hasCurrentSession: !!response.currentSession,
      currentSessionKeys: response.currentSession ? Object.keys(response.currentSession) : [],
      sessionFile: response.currentSession?.sessionFile,
      shortId: response.currentSession?.shortId,
      messageCount: response.currentSession?.messages?.length,
      firstMessage: response.currentSession?.messages?.[0],
    });

    // 重建界面（更新所有状态）
    console.log("[SessionManager.selectSession] 调用 handleInitResponse, stores.chat:", {
      hasSetMessages: typeof stores.chat?.setMessages === 'function',
    });
    await handleInitResponse(response, stores);

    console.log("[SessionManager.selectSession] 界面重建完成");
  } catch (error) {
    console.error("[SessionManager.selectSession] error:", error);
    // 降级：只更新 UI 状态（使用短 ID）
    const shortId = extractShortSessionId(session.path);
    stores.sidebar.setSelectedSessionId(shortId);
    stores.session.setCurrentSession(shortId);
    stores.session.setCurrentSessionFile(session.path);
  } finally {
    // 结束 loading
    stores.sidebar.setLoading(false);
    console.log("[SessionManager.selectSession] loading 结束");
  }
}

/**
 * 创建新 session
 * 轻量级实现：只添加新 session 到列表并选中，不重建整个界面
 * 使用覆盖式 loading，不清空界面直到服务器返回
 */
async function createNewSession(): Promise<void> {
  const stores = getStores();

  // 设置加载状态（覆盖式，不清空界面）
  stores.sidebar.setLoading(true);
  console.log("[SessionManager.createNewSession] 开始创建，显示 loading");

  try {
    // 1. 发送创建请求，等待服务器返回新 session 信息
    const createResponse = await new Promise<{
      sessionId: string;
      sessionFile: string;
      allSessions?: any[];
    }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("创建 session 超时")), 10000);

      createNewChatSession(stores.session.workingDir);

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
      lastModified: new Date().toISOString(),
    };

    // 3. 添加到 session 列表最前面（避免重复）
    const existingSessions = stores.sidebar.sessions;
    const filteredSessions = existingSessions.filter((s) => s.path !== newSession.path);
    const updatedSessions = [newSession, ...filteredSessions];

    stores.sidebar.setSessions(updatedSessions);
    console.log("[SessionManager.createNewSession] 已添加到列表:", newSession.path);

    // 4. 选中新 session
    stores.sidebar.setSelectedSessionId(newSession.id);
    stores.session.setCurrentSession(newSession.id);
    stores.session.setCurrentSessionFile(newSession.path);
    console.log("[SessionManager.createNewSession] 已选中:", newSession.id);

    // 5. 清空聊天消息区域并重置所有状态（新 session 从干净状态开始）
    stores.chat.setMessages([]);
    stores.chat.abortStreaming();
    stores.chat.setIsRunning(false);
    stores.chat.clearInput();
    console.log("[SessionManager.createNewSession] 已清空消息区域并重置状态");

    // 6. 如果服务端返回了完整列表，使用服务端的（确保同步）
    if (createResponse.allSessions && createResponse.allSessions.length > 0) {
      const serverSessions = createResponse.allSessions.map((s: any) => ({
        id: s.path || s.id,
        path: s.path || s.id,
        name: s.name || s.firstMessage?.slice(0, 35) || "Untitled",
        messageCount: s.messageCount || 0,
        lastModified: s.modified || s.lastModified || new Date().toISOString(),
      }));
      stores.sidebar.setSessions(serverSessions);
      console.log("[SessionManager.createNewSession] 已同步服务端列表:", serverSessions.length);
    }

    console.log("[SessionManager.createNewSession] 完成");
  } catch (error) {
    console.error("[SessionManager.createNewSession] 错误:", error);
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
