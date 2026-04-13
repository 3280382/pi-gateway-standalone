/**
 * useSidebarSessions - Sidebar Sessions 管理 Hook
 *
 * 职责：
 * - 从 WebSocket init 响应获取 sessions（不再使用 HTTP API）
 * - 提供手动刷新功能（如果需要）
 *
 * 架构：
 * - 所有初始化数据来自 WebSocket init 响应
 * - 只有 workingDir 保存在 localStorage
 * - 其他所有数据（sessions、models 等）都从 WebSocket 获取
 */

import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";

interface UseSidebarSessionsResult {
  sessions: Session[];
  isLoading: boolean;
}

export function useSidebarSessions(): UseSidebarSessionsResult {
  const storeSessions = useSidebarStore((state) => state.sessions);

  // Sessions 从 WebSocket init 响应自动填充到 store
  // 不再使用 HTTP API 获取

  return {
    sessions: storeSessions,
    isLoading: false,
  };
}
