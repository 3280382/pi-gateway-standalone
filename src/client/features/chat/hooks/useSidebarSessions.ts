/**
 * useSidebarSessions - Sidebar Sessions 管理 Hook
 *
 * 职责：
 * - 从 localStorage 恢复 sessions（不再自动从服务器获取）
 * - 提供手动刷新功能（从服务器获取最新 sessions）
 * - 处理加载状态和错误
 */

import { useCallback, useState } from "react";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { fetchApi } from "@/services/client";
import type { Session } from "@/features/chat/types/sidebar";

interface UseSidebarSessionsResult {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 将 API 返回的 session 数据转换为 Session 对象
 */
function mapSession(s: any): Session {
  return {
    id: s.path,
    path: s.path,
    name: s.firstMessage?.slice(0, 35) || s.path?.split("/").pop() || "Untitled",
    messageCount: s.messageCount || 0,
    lastModified: new Date(s.modified),
    firstMessage: s.firstMessage,
  };
}

export function useSidebarSessions(): UseSidebarSessionsResult {
  const { workingDir } = useWorkspaceStore();
  const storeSessions = useSidebarStore((state) => state.sessions);
  const setStoreSessions = useSidebarStore((state) => state.setSessions);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 手动刷新 - 从服务器获取最新 sessions
  const refresh = useCallback(async () => {
    if (!workingDir) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchApi<{ sessions: any[] }>(
        `/sessions?cwd=${encodeURIComponent(workingDir)}`
      );
      const sessions = (data.sessions || []).map(mapSession);
      setStoreSessions(sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load sessions";
      setError(message);
      console.error("[useSidebarSessions] Failed to load sessions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workingDir, setStoreSessions]);

  // 不再自动加载 - 从 localStorage 恢复
  // sessions 由 sidebarStore 的 persist 配置自动恢复

  return {
    sessions: storeSessions,
    isLoading,
    error,
    refresh,
  };
}
