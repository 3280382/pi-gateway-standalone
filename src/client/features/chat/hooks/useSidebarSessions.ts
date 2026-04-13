/**
 * useSidebarSessions - Sidebar Sessions 加载 Hook
 *
 * 职责：
 * - 当 sidebar 可见且处于 chat 视图时，加载当前工作目录的所有 sessions
 * - 支持手动刷新
 * - 处理加载状态和错误
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

export function useSidebarSessions(
  isVisible: boolean,
  currentView: "chat" | "files"
): UseSidebarSessionsResult {
  const { workingDir } = useWorkspaceStore();
  const storeSessions = useSidebarStore((state) => state.sessions);
  const setStoreSessions = useSidebarStore((state) => state.setSessions);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } finally {
      setIsLoading(false);
    }
  }, [workingDir, setStoreSessions]);

  // 当 sidebar 可见且处于 chat 视图时自动加载
  useEffect(() => {
    if (isVisible && currentView === "chat" && workingDir) {
      loadSessions();
    }
  }, [isVisible, currentView, workingDir, loadSessions]);

  return {
    sessions: storeSessions,
    isLoading,
    error,
    refresh: loadSessions,
  };
}
