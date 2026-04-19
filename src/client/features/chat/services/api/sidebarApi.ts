/**
 * Sidebar API - Controller Layer
 *
 * 重构后Responsibilities:
 * - 提供 React Hook 接口
 * - 委托给 sessionManager 处理 session 逻辑
 * - 所有数据来自 WebSocket，不使用 HTTP API
 */

import { useCallback } from "react";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { websocketService } from "@/services/websocket.service";
import type { SidebarController } from "@/features/chat/types/sidebar";

// ============================================================================
// Controller Hook
// ============================================================================

export function useSidebarController(): SidebarController {
  const store = useSidebarStore();

  return {
    // Data Loading - 不再需要，数据来自 WebSocket init
    loadWorkingDir: useCallback(async () => {
      // 工作目录来自 WebSocket init 响应，不需要 HTTP 获取
      console.log("[SidebarController] loadWorkingDir: data comes from WebSocket init");
    }, []),

    loadSessions: useCallback(async (_cwd: string) => {
      // Sessions 来自 WebSocket init 响应，不需要 HTTP 获取
      console.log("[SidebarController] loadSessions: data comes from WebSocket init");
    }, []),

    // Actions - 委托给 sessionManager (WebSocket)
    changeWorkingDir: useCallback(
      (path: string) =>
        sessionManager.switchDirectory(path, {
          clearSessions: true,
          loadSessions: true,
          restoreLastSession: true,
        }),
      []
    ),

    selectSession: useCallback((id: string) => sessionManager.selectSession(id), []),

    createNewSession: useCallback(() => sessionManager.createNewSession(), []),

    // List sessions via WebSocket
    listSessions: useCallback(() => {
      const workingDir = useSessionStore.getState().workingDir;
      const status = websocketService.getConnectionStatus();
      if (workingDir && status.isConnected) {
        websocketService.send("list_sessions", { workingDir });
      }
    }, []),

    // Error Handling
    clearError: useCallback(() => store.clearError(), [store]),
  };
}

// ============================================================================
// Non-hook API (for non-React contexts)
// ============================================================================

export function createSidebarController(): SidebarController {
  const store = useSidebarStore.getState();

  return {
    loadWorkingDir: async () => {
      // 工作目录来自 WebSocket init 响应
      console.log("[SidebarController] loadWorkingDir: data comes from WebSocket init");
    },

    loadSessions: async (_cwd: string) => {
      // Sessions 来自 WebSocket init 响应
      console.log("[SidebarController] loadSessions: data comes from WebSocket init");
    },

    changeWorkingDir: (path: string) =>
      sessionManager.switchDirectory(path, {
        clearSessions: false,
        loadSessions: false,
        restoreLastSession: true,
      }),

    selectSession: (id: string) => sessionManager.selectSession(id),

    createNewSession: () => sessionManager.createNewSession(),

    listSessions: () => {
      const workingDir = useSessionStore.getState().workingDir;
      const status = websocketService.getConnectionStatus();
      if (workingDir && status.isConnected) {
        websocketService.send("list_sessions", { workingDir });
      }
    },

    clearError: () => store.clearError(),
  };
}
