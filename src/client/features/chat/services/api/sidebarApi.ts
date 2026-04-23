/**
 * Sidebar API - Controller Layer
 *
 * Responsibilities:
 * - 提供 React Hook 接口
 * - 委托给 sessionManager 处理 session 逻辑
 */

import { sessionManager } from "@/features/chat/services/sessionManager";
import type { SidebarController } from "@/features/chat/types/sidebar";

export function useSidebarController(): SidebarController {
  return {
    changeWorkingDir: (path: string) =>
      sessionManager.switchDirectory(path, {
        clearSessions: true,
      }),
  };
}
