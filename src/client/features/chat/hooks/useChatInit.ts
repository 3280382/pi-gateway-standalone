/**
 * useChatInit - Chat 页面初始化 Hook
 *
 * 职责：WebSocket 连接、session 恢复
 * 仅在 Chat 页面加载时执行
 */

// ===== [ANCHOR:IMPORTS] =====

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { websocketService } from "@/services/websocket.service";
import { setupWebSocketListeners } from "../services/api/chatApi";
import { initChatWorkingDirectory } from "../services/chatWebSocket";

// ===== [ANCHOR:TYPES] =====

interface InitResponse {
  cwd: string;
  sessionId?: string;
  sessionFile?: string;
  pid?: number;
  model?: string;
  thinkingLevel?: string;
}

// ===== [ANCHOR:HOOK] =====

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

      // 2. 发送 init 请求，不带参数，让服务器根据当前工作目录决定
      // 服务器会返回当前 session 状态，客户端不再从 localStorage 恢复 session
      console.log("[ChatInit] Sending init request to server...");

      const initResponse = await initChatWorkingDirectory(
        "/root", // 默认根目录，服务器会根据实际情况返回
        undefined, // 不传 sessionId，让服务器决定
        5000 // 5秒超时
      ).catch((err) => {
        console.log("[ChatInit] init error or timeout:", err);
        return null;
      });

      // 3. 如果服务器返回 active session，恢复 UI
      if (initResponse?.sessionId && initResponse?.sessionFile && initResponse?.cwd) {
        console.log("[ChatInit] 服务器返回 session，同步 UI:", {
          sessionId: initResponse.sessionId,
          cwd: initResponse.cwd,
        });

        // 更新所有 store 状态（以服务器返回的为准）
        useSessionStore.getState().setCurrentSession(initResponse.sessionFile);
        // 更新全局 workspaceStore 的 workingDir
        useWorkspaceStore.getState().setWorkingDir(initResponse.cwd);
        useSidebarStore.getState().setWorkingDir(initResponse.cwd);
        useSessionStore.getState().setIsConnected(true);

        if (initResponse.pid) {
          useSessionStore.getState().setServerPid(initResponse.pid);
        }
        if (initResponse.model) {
          useSessionStore.getState().setCurrentModel(initResponse.model);
        }
        if (initResponse.thinkingLevel) {
          useSessionStore.getState().setThinkingLevel(initResponse.thinkingLevel as any);
        }

        // 加载 session 消息历史
        try {
          await useChatStore.getState().loadSession(initResponse.sessionFile);
        } catch (e) {
          console.warn("[ChatInit] 加载 session 消息失败:", e);
        }

        // 选中当前 session
        useSidebarStore.getState().setSelectedSessionId(initResponse.sessionFile);
      }
      // 4. 服务器没有 active session，使用默认工作目录
      else {
        console.log("[ChatInit] 服务器没有 active session，使用默认配置");
        useWorkspaceStore.getState().setWorkingDir("/root");
        useSidebarStore.getState().setWorkingDir("/root");
        useSessionStore.getState().setWorkingDir("/root");
        useSessionStore.getState().setIsConnected(true);
      }
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
