/**
 * useChatInit - Chat 页面初始化 Hook
 *
 * 职责：
 * 1. WebSocket 连接
 * 2. 发送 init 请求（带 workingDir）
 * 3. 处理服务器返回的完整数据，恢复界面
 *
 * 服务器返回数据：
 * - pid: 顶部菜单显示
 * - workingDir: 当前工作目录
 * - currentSession: { sessionId, sessionFile, messages } - 聊天界面历史消息
 * - allSessions: 左侧面板所有 session 列表
 * - currentModel: 当前模型
 * - allModels: 左侧面板所有模型列表
 * - thinkingLevel: 思考级别
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { websocketService } from "@/services/websocket.service";
import { setupWebSocketListeners } from "../services/api/chatApi";
import { initChatWorkingDirectory } from "../services/chatWebSocket";
import type { Session } from "@/features/chat/types/sidebar";

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

      // 2. 从 localStorage 获取当前工作目录
      const savedWorkingDir = useWorkspaceStore.getState().workingDir;
      console.log("[ChatInit] Sending init with workingDir:", savedWorkingDir);

      // 3. 发送 init 请求，传入当前工作目录
      const initResponse = await initChatWorkingDirectory(
        savedWorkingDir,
        undefined,
        10000 // 10秒超时，因为需要加载文件
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

      // 5.1 全局工作目录
      useWorkspaceStore.getState().setWorkingDir(workingDir);

      // 5.2 Session 状态
      useSessionStore.getState().setWorkingDir(workingDir);
      useSessionStore.getState().setIsConnected(true);
      useSessionStore.getState().setServerPid(pid);
      useSessionStore.getState().setCurrentModel(currentModel);
      useSessionStore.getState().setThinkingLevel(thinkingLevel as any);
      useSessionStore.getState().setAvailableModels(allModels || []);

      // 5.3 Sidebar 状态
      console.log("[ChatInit] Setting sidebar state:", {
        workingDir,
        allSessionsCount: allSessions?.length,
        currentSessionFile: currentSession?.sessionFile,
      });
      useSidebarStore.getState().setWorkingDir(workingDir);
      useSidebarStore.getState().setSessions(allSessions || []);
      useSidebarStore.getState().setSelectedSessionId(currentSession?.sessionFile || null);

      // 5.4 聊天历史消息
      console.log("[ChatInit] Messages from server:", currentSession?.messages?.length || 0);
      if (currentSession?.messages?.length > 0) {
        // 转换服务器返回的消息格式为客户端格式
        const formattedMessages = currentSession.messages
          .filter((entry: any) => entry.type === "message" && entry.message)
          .map((entry: any) => {
            const msg = entry.message;
            // 处理 content 数组，提取文本内容
            let contentText = "";
            if (Array.isArray(msg.content)) {
              contentText = msg.content
                .filter((c: any) => c.type === "text")
                .map((c: any) => c.text)
                .join("\n");
            } else if (typeof msg.content === "string") {
              contentText = msg.content;
            }

            return {
              id: entry.id || msg.id || `${Date.now()}-${Math.random()}`,
              role: msg.role || "user",
              content: contentText,
              timestamp: entry.timestamp || new Date().toISOString(),
            };
          });

        console.log("[ChatInit] Restored messages:", formattedMessages.length);
        useChatStore.getState().setMessages(formattedMessages);
      }

      // 5.5 保存模型列表到 sessionStore（用于 ModelParamsSection）
      useSessionStore.setState({ availableModels: allModels || [] });

      console.log("[ChatInit] UI fully restored from server data");
    } catch (err) {
      console.error("[ChatInit] 初始化错误:", err);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { isConnecting };
}
