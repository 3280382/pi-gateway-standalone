/**
 * Session Manager - 统一会话管理模块
 *
 * 职责：
 * 1. 封装 session 生命周期管理（切换目录、选择 session、恢复 session）
 * 2. 协调 sidebarStore、sessionStore、workspaceStore、chatStore 的更新
 * 3. 提供类型安全的 session 操作方法
 * 4. 隐藏 WebSocket 通信细节
 * 
 * 注意：所有数据通过 WebSocket 获取，不使用 HTTP API
 */

import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import { useWorkspaceStore as useGlobalWorkspaceStore } from "@/stores/workspaceStore";
import { websocketService } from "@/services/websocket.service";
import { changeChatDirectory, createNewChatSession } from "./chatWebSocket";

// ============================================================================
// Types
// ============================================================================

export interface SwitchDirOptions {
  /** 是否清空当前 sessions 列表（切换目录时通常 true） */
  clearSessions?: boolean;
  /** 是否加载新目录的 sessions 列表（切换目录时通常 true） */
  loadSessions?: boolean;
  /** 是否优先恢复上次使用的 session（切换目录时通常 true） */
  restoreLastSession?: boolean;
}

export interface SessionManagerAPI {
  /** 切换工作目录 */
  switchDirectory: (dir: string, options?: SwitchDirOptions) => Promise<void>;
  /** 选择指定 session */
  selectSession: (sessionId: string) => Promise<void>;
  /** 创建新 session */
  createNewSession: () => Promise<void>;
  /** 获取当前目录上次使用的 session ID */
  getLastSessionForDir: (dir: string) => string | undefined;
  /** 检查 session 是否存在于当前列表 */
  sessionExists: (sessionId: string) => boolean;
}

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * 从 session ID 或 path 中提取可匹配的标识
 */
function extractSessionId(pathOrId: string | undefined): string {
  if (!pathOrId) return "";
  // 如果是 path（如 /root/.pi/.../xxx.jsonl），提取文件名中的 UUID
  if (pathOrId.includes("/")) {
    const fileName = pathOrId.split("/").pop() || "";
    if (!fileName) return pathOrId;
    return fileName.replace(".jsonl", "").split("_").pop() || pathOrId;
  }
  return pathOrId;
}

/**
 * 在 sessions 列表中查找匹配的 session
 */
function findSessionInList(sessions: Session[], sessionId: string): Session | undefined {
  const normalizedId = extractSessionId(sessionId);
  return sessions.find(
    (s) =>
      s.id === sessionId ||
      s.path.includes(normalizedId) ||
      extractSessionId(s.path) === normalizedId
  );
}

// ============================================================================
// Store Accessors (避免重复获取 getState)
// ============================================================================

function getStores() {
  return {
    sidebar: useSidebarStore.getState(),
    session: useSessionStore.getState(),
    globalWorkspace: useGlobalWorkspaceStore.getState(),
    chat: useChatStore.getState(),
  };
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * 切换工作目录
 */
async function switchDirectory(targetDir: string, options: SwitchDirOptions = {}): Promise<void> {
  const { clearSessions = true } = options;
  const stores = getStores();

  console.log("[SessionManager.switchDirectory] ========== START ==========");
  console.log(`[SessionManager.switchDirectory] 1. targetDir="${targetDir}"`);
  console.log(`[SessionManager.switchDirectory] 2. current workingDir="${stores.sidebar.workingDir?.path}"`);

  // 1. 更新 loading 状态
  stores.sidebar.setLoading(true);

  try {
    // 2. 发送 WebSocket 请求
    console.log(`[SessionManager.switchDirectory] 3. Sending change_dir request...`);

    const response = await new Promise<{
      cwd: string;
      sessionId?: string;
      sessionFile?: string;
      pid?: number;
      allSessions?: Session[];
      currentModel?: string;
      allModels?: any[];
      thinkingLevel?: string;
      messages?: any[];
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`[SessionManager.switchDirectory] TIMEOUT: 5s passed without response`);
        reject(new Error("切换目录超时"));
      }, 5000);

      changeChatDirectory(targetDir);

      const unsub = websocketService.on("dir_changed", (data) => {
        console.log(`[SessionManager.switchDirectory] 4. Received dir_changed event:`, data);
        clearTimeout(timeout);
        unsub();
        resolve(data as any);
      });
    });

    const workingDir = response.workingDir || response.cwd; // 兼容两种格式
    console.log(
      `[SessionManager.switchDirectory] 5. Response received: workingDir="${workingDir}", sessionId="${response.sessionId}"`
    );

    // 3. 更新各 store 的工作目录和连接状态
    stores.globalWorkspace.setWorkingDir(workingDir);
    stores.sidebar.setWorkingDir(workingDir);
    stores.session.setWorkingDir(workingDir);
    stores.session.setIsConnected(true);
    
    if (response.pid) {
      stores.session.setServerPid(response.pid);
    }
    if (response.currentModel) {
      stores.session.setCurrentModel(response.currentModel);
    }
    if (response.thinkingLevel) {
      stores.session.setThinkingLevel(response.thinkingLevel as any);
    }
    if (response.allModels) {
      stores.session.setAvailableModels(response.allModels);
    }

    // 4. 处理 sessions 列表
    if (clearSessions) {
      stores.sidebar.setSessions([]);
      stores.sidebar.setSelectedSessionId(null);
    }

    // 使用服务器返回的 sessions 列表
    if (response.allSessions && response.allSessions.length > 0) {
      stores.sidebar.setSessions(response.allSessions);
    }

    // 5. 确定要使用的 session
    let sessionToUse: Session | undefined;

    // 优先使用服务器返回的当前 session
    const currentSession = response.currentSession;
    if (currentSession?.sessionId && currentSession?.sessionFile) {
      sessionToUse = {
        id: currentSession.sessionFile,
        path: currentSession.sessionFile,
        name: "Current Session",
        messageCount: currentSession.messages?.length || 0,
        lastModified: new Date(),
      };
      
      // 添加到 sessions 列表（如果不存在）
      const existingSessions = stores.sidebar.sessions;
      if (!existingSessions.find(s => s.path === currentSession.sessionFile)) {
        stores.sidebar.setSessions([sessionToUse, ...existingSessions]);
      }
      
      console.log("[SessionManager] 使用服务端当前 session:", currentSession.sessionId);
    }

    // 6. 加载消息历史（如果服务器返回了）
    const sessionMessages = currentSession?.messages;
    if (sessionMessages && sessionMessages.length > 0) {
      const formattedMessages = sessionMessages
        .filter((entry: any) => entry.type === "message" && entry.message)
        .map((entry: any) => {
          const msg = entry.message;
          // 转换 content 为 MessageContent[] 格式
          let contentArray: any[] = [];
          if (Array.isArray(msg.content)) {
            contentArray = msg.content.map((c: any) => ({
              type: c.type || "text",
              text: c.text,
              thinking: c.thinking,
              signature: c.thinkingSignature || c.signature,
              toolCallId: c.toolCallId || c.id,
              toolName: c.name || c.toolName,
              args: c.arguments || c.args,
              output: c.output,
              error: c.error,
            }));
          } else if (typeof msg.content === "string") {
            contentArray = [{ type: "text", text: msg.content }];
          }
          return {
            id: entry.id || msg.id || `${Date.now()}-${Math.random()}`,
            role: msg.role || "user",
            content: contentArray,
            timestamp: entry.timestamp || new Date().toISOString(),
          };
        });
      
      stores.chat.setMessages(formattedMessages);
      console.log("[SessionManager] 已加载消息历史:", formattedMessages.length);
    }

    // 7. 选中当前 session
    if (sessionToUse) {
      stores.sidebar.setSelectedSessionId(sessionToUse.id);
      stores.session.setCurrentSession(sessionToUse.id);
    }

    const finalWorkingDir = response.workingDir || response.cwd;
    console.log("[SessionManager] 目录切换完成:", {
      dir: finalWorkingDir,
      session: sessionToUse?.id,
    });
  } finally {
    stores.sidebar.setLoading(false);
  }
}

/**
 * 选择指定 session（用户手动选择）
 */
async function selectSession(sessionId: string): Promise<void> {
  const stores = getStores();
  const sessions = stores.sidebar.sessions;
  const session = findSessionInList(sessions, sessionId);

  if (!session) {
    console.warn("[SessionManager] Session 不存在:", sessionId);
    return;
  }

  console.log("[SessionManager] 用户选择 session:", sessionId);
  
  // 更新选中状态
  stores.sidebar.setSelectedSessionId(session.id);
  stores.session.setCurrentSession(session.id);
  
  // 加载 session 消息
  if (session.path) {
    await stores.chat.loadSession(session.path);
  }
  
  // 通知服务端
  websocketService.send("load_session", { sessionPath: session.path });
}

/**
 * 创建新 session
 */
async function createNewSession(): Promise<void> {
  const stores = getStores();

  stores.sidebar.setLoading(true);
  console.log("[SessionManager] 创建新 session");

  try {
    const response = await new Promise<{
      sessionId: string;
      sessionFile: string;
    }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("创建 session 超时")), 5000);

      createNewChatSession();

      const unsub = websocketService.on("session_created", (data) => {
        clearTimeout(timeout);
        unsub();
        resolve(data);
      });
    });

    // 创建新 session 对象
    const newSession: Session = {
      id: response.sessionFile,
      path: response.sessionFile,
      name: "New Session",
      messageCount: 0,
      lastModified: new Date(),
    };

    // 添加到列表并激活
    const existingSessions = stores.sidebar.sessions;
    stores.sidebar.setSessions([newSession, ...existingSessions]);
    
    stores.sidebar.setSelectedSessionId(newSession.id);
    stores.session.setCurrentSession(newSession.id);

    // 清空消息列表（新 session）
    stores.chat.setMessages([]);
    stores.chat.clearMessages();

    // 设置连接状态
    stores.session.setIsConnected(true);

    console.log("[SessionManager] 新 session 创建完成:", response.sessionId);
  } finally {
    stores.sidebar.setLoading(false);
  }
}

/**
 * 获取指定目录上次使用的 session ID
 * 注意：不再从 localStorage 获取，服务器决定使用哪个 session
 */
function getLastSessionForDir(_dir: string): string | undefined {
  // 服务器决定使用哪个 session，客户端不保存
  return undefined;
}

/**
 * 检查 session 是否存在于当前列表
 */
function sessionExists(sessionId: string): boolean {
  const sessions = useSidebarStore.getState().sessions;
  return !!findSessionInList(sessions, sessionId);
}

// ============================================================================
// Public API
// ============================================================================

export const sessionManager: SessionManagerAPI = {
  switchDirectory,
  selectSession,
  createNewSession,
  getLastSessionForDir,
  sessionExists,
};

// 为了兼容性，也提供 hook 版本
export function useSessionManager(): SessionManagerAPI {
  return sessionManager;
}
