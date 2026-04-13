/**
 * useSidebarSessions - Sidebar Sessions 管理 Hook
 *
 * 职责：
 * - 以当前工作目录为参数，从服务器获取所有历史 session 文件
 * - 当工作目录变化时自动重新获取
 * - 处理加载状态和错误
 *
 * 架构：
 * - sessions 不保存在 localStorage，每次从服务器获取
 * - 只有 workingDir 保存在 localStorage（由 workspaceStore 管理）
 */

import { useCallback, useEffect, useState } from "react";
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

  // 从服务器获取 sessions
  const loadSessions = useCallback(async () => {
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
      // 出错时清空 sessions
      setStoreSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [workingDir, setStoreSessions]);

  // 当工作目录变化时自动重新获取
  useEffect(() => {
    if (workingDir) {
      loadSessions();
    }
  }, [workingDir, loadSessions]);

  return {
    sessions: storeSessions,
    isLoading,
    error,
    refresh: loadSessions,
  };
}
