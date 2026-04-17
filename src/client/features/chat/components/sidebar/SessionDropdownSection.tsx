/**
 * SessionDropdownSection - Session dropdown selector
 *
 * 职责：
 * - 显示所有历史 session 文件列表
 * - 当前选中的 session 是服务器正在使用的 session
 * - 支持切换 session
 * - 紧凑的自定义下拉框样式
 *
 * 注意：新建会话的唯一入口是聊天输入框右侧的新建按钮
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import type { Session } from "@/features/chat/types/sidebar";
import styles from "./SidebarPanel.module.css";

export function SessionDropdownSection() {
  // ========== 1. State ==========
  const sessions = useSidebarStore((state) => state.sessions);
  const currentSessionId = useSidebarStore((state) => state.selectedSessionId);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const workingDir = useSessionStore((state) => state.workingDir);
  const controller = useSidebarController();
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // ========== 2. Effects ==========
  // 定期获取活跃会话状态
  useEffect(() => {
    if (!workingDir) return;

    const fetchActiveSessions = async () => {
      try {
        const response = await fetch(
          `/api/sessions/active?workingDir=${encodeURIComponent(workingDir)}`
        );
        if (response.ok) {
          const data = await response.json();
          const activeFiles = new Set<string>(
            data.activeSessions
              .filter((s: any) => s.isActive)
              .map((s: any) => s.sessionFile as string)
          );
          setActiveSessions(activeFiles);
        }
      } catch (error) {
        console.error("Failed to fetch active sessions:", error);
      }
    };

    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 5000); // 每5秒刷新
    return () => clearInterval(interval);
  }, [workingDir]);

  // ========== 3. Actions ==========
  const handleSelect = useCallback(
    async (session: Session) => {
      await controller.selectSession(session.id);
    },
    [controller]
  );

  // ========== 4. Computed ==========
  // 对会话进行排序：活跃的在前，然后按消息数量排序
  const sortedSessions = [...sessions].sort((a, b) => {
    const aActive = activeSessions.has(a.id);
    const bActive = activeSessions.has(b.id);
    
    // 活跃状态优先
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    
    // 然后按消息数量排序
    if (a.messageCount !== b.messageCount) {
      return b.messageCount - a.messageCount;
    }
    
    // 最后按ID（或名称）排序
    return (a.name || a.id).localeCompare(b.name || b.id);
  });

  // Debug: log sessions data
  console.log("[SessionDropdownSection] Sessions:", {
    count: sessions.length,
    currentSessionId: currentSessionId?.slice(-8),
    sessions: sessions.map((s) => ({ id: s.id.slice(-8), name: s.name, msgCount: s.messageCount })),
  });

  // ========== 5. Render ==========
  if (isLoading && sessions.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Session</h3>
        </div>
        <div className={styles.loading}>Loading...</div>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Session</h3>
        </div>
        <div className={styles.emptyText}>No sessions</div>
      </section>
    );
  }

  return (
    <section className={styles.section} style={{ position: "relative" }}>
      {/* 覆盖式 Loading 遮罩 */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>Loading...</span>
        </div>
      )}

      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Session</h3>
      </div>

      <div className={styles.sessionListContainer} ref={containerRef}>
        {sortedSessions.map((session) => {
          const isActive = activeSessions.has(session.id);
          return (
            <div
              key={session.id}
              className={`${styles.sessionListItem} ${session.id === currentSessionId ? styles.active : ""}`}
              onClick={() => handleSelect(session)}
            >
              <div className={styles.sessionItemContent}>
                <span className={styles.sessionName}>
                  {session.name || `Session ${session.id.slice(-8)}`}
                  {isActive && (
                    <span className={styles.activeIndicator}>
                      ●
                    </span>
                  )}
                </span>
                {session.messageCount > 0 && (
                  <span className={styles.sessionCount}>{session.messageCount}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
