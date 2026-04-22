/**
 * useChatInit - Chat Pages面初始化 Hook
 *
 * Responsibilities:
 * 1. WebSocket 连接
 * 2. Send init 请求（带 workingDir）
 * 3. 处理服务器返回的完整数据，恢复界面
 *
 * 服务器返回数据：
 * - pid: 顶部菜单显示
 * - workingDir: 当前工作directories
 * - currentSession: { sessionId, sessionFile, messages } - 聊天界面历史消息
 * - allSessions: 左侧面板所有 session Cols表
 * - currentModel: 当前模型
 * - allModels: 左侧面板所有Model list
 * - thinkingLevel: Thinking level
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import { handleServerMessages } from "@/features/chat/utils/messageUtils";
import { websocketService } from "@/services/websocket.service";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { setupWebSocketListeners } from "../services/api/chatApi";
import { initChatWorkingDirectory } from "../services/chatWebSocket";

interface InitResponse {
  pid: number;
  workingDir: string;
  currentSession: {
    sessionId: string;
    sessionFile: string;
    messages: any[];
  };
  allSessions: Session[];
  currentModel: string | null;
  allModels: Array<{
    id: string;
    name: string;
    provider?: string;
    maxTokens?: number;
    contextWindow?: number;
    reasoning?: boolean;
    input?: string[];
  }>;
  thinkingLevel: string;
}

export function useChatInit(): { isConnecting: boolean } {
  const [isConnecting, setIsConnecting] = useState(true);
  const hasInitialized = useRef(false);

  const initialize = useCallback(async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      // 1. WebSocket 连接
      let wsConnected = false;
      try {
        await websocketService.connect(undefined, 10000);
        wsConnected = websocketService.isConnected;
        console.log("[ChatInit] WebSocket connected");
        setupWebSocketListeners();
      } catch {
        console.warn("[ChatInit] WebSocket not available");
      }

      if (!wsConnected) {
        setIsConnecting(false);
        return;
      }

      // 2. 从全局 workspaceStore 读取当前工作目录和对应 sessionFile
      const workspaceStore = useWorkspaceStore.getState();
      const savedWorkspace = workspaceStore.currentPath;
      // 优先从 recentWorkspaces 获取 lastSessionFile，否则 fallback 到 sessionFiles 映射
      const recentWorkspace = workspaceStore.recentWorkspaces.find(
        (w) => w.path === savedWorkspace
      );
      const savedSessionFile =
        recentWorkspace?.lastSessionFile ?? workspaceStore.getSessionFile(savedWorkspace);
      const messageLimit = workspaceStore.defaultMessageLimit;

      console.log("[ChatInit] Restoring from localStorage:", {
        currentWorkspace: savedWorkspace,
        sessionFile: savedSessionFile,
        messageLimit,
      });

      // 3. Send init 请求，传入 workspace 和对应的 sessionFile
      const initResponse = await initChatWorkingDirectory(
        savedWorkspace,
        savedSessionFile, // 传递该 workspace 的 sessionFile 用于精确恢复
        10000,
        messageLimit
      ).catch((err) => {
        console.error("[ChatInit] init error:", err);
        return null;
      });

      if (!initResponse) {
        setIsConnecting(false);
        return;
      }

      // 4. 处理服务器返回的完整数据
      console.log("[ChatInit] Server returned full init data:", {
        pid: initResponse.pid,
        workingDir: initResponse.workingDir,
        sessionsCount: initResponse.allSessions?.length,
        modelsCount: initResponse.allModels?.length,
        currentSessionId: initResponse.currentSession?.sessionId,
      });

      const {
        pid,
        workingDir,
        currentSession,
        allSessions,
        currentModel,
        allModels,
        thinkingLevel,
      } = initResponse as InitResponse;

      // 5. 恢复所有状态

      // 5.1 全局工作目录（唯一权威来源，同时保存 sessionFile 到 recentWorkspaces）
      useWorkspaceStore.getState().setCurrentPath(workingDir, currentSession?.sessionFile);

      // 5.3 Session 运行时状态
      useSessionStore.getState().setWorkingDir(workingDir);
      useSessionStore.getState().setIsConnected(true);
      useSessionStore.getState().setServerPid(pid);
      useSessionStore.getState().setCurrentModel(currentModel);
      useSessionStore.getState().setThinkingLevel(thinkingLevel as any);
      useSessionStore.getState().setAvailableModels((allModels || []) as any);
      useSessionStore.getState().setCurrentSessionFile(currentSession?.sessionFile || null);

      // 5.3 Sidebar 状态
      console.log("[ChatInit] Setting sidebar state:", {
        workingDir,
        allSessionsCount: allSessions?.length,
        currentSessionFile: currentSession?.sessionFile,
      });
      useSidebarStore.getState().setWorkingDir(workingDir);
      // 使用 sessionManager 的辅助函数统一更新 sessions 和状态
      const { updateSessionsAndStatus } = await import("@/features/chat/services/sessionManager");
      updateSessionsAndStatus(useSidebarStore.getState(), allSessions || []);
      // 使用服务器返回的短 ID 作为选中 session ID（与 sidebar 中的 session.id 一致）
      const shortId = (currentSession as any)?.shortId || null;
      useSidebarStore.getState().setSelectedSessionId(shortId);

      // 5.4 聊天历史消息（服务器已预处理，直接使用）
      console.log("[ChatInit] Messages from server:", currentSession?.messages?.length || 0);
      if (currentSession?.messages?.length > 0) {
        const formattedMessages = handleServerMessages(currentSession.messages);
        console.log("[ChatInit] Restored messages:", formattedMessages.length);
        useChatStore.getState().setMessages(formattedMessages);
      }

      // 5.5 保存Model list到 sessionStore（用于 ModelParamsSection）
      useSessionStore.setState({ availableModels: (allModels || []) as any });

      console.log("[ChatInit] UI fully restored from server data");
    } catch (err) {
      console.error("[ChatInit] 初始化Error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { isConnecting };
}
