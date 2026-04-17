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
  // 对会话进行排序：活跃的在前，其他按最后修改时间排序（最新的在前）
  const sortedSessions = [...sessions].sort((a, b) => {
    const aActive = activeSessions.has(a.id);
    const bActive = activeSessions.has(b.id);
    
    // 1. 活跃状态优先
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    
    // 2. 都是活跃或都是非活跃时，按最后修改时间排序（最新的在前）
    const aTime = new Date(a.lastModified).getTime();
    const bTime = new Date(b.lastModified).getTime();
    return bTime - aTime;
  });

  // Debug: log sessions data
  console.log("[SessionDropdownSection] Sessions:", {
    count: sessions.length,
    currentSessionId: currentSessionId,
    currentSessionIdShort: currentSessionId?.slice(-8),
    sessions: sessions.map((s) => ({ id: s.id, idShort: s.id.slice(-8), name: s.name, msgCount: s.messageCount })),
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
          // 使用完整路径或多种格式进行匹配
          const isActive = activeSessions.has(session.id) || 
                          activeSessions.has(session.path) ||
                          Array.from(activeSessions).some(activeId => 
                            activeId.includes(session.id) || session.id.includes(activeId)
                          );
          const isSelected = session.id === currentSessionId || 
                            session.path === currentSessionId ||
                            (currentSessionId && (session.id.includes(currentSessionId) || currentSessionId.includes(session.id)));
          
          // Debug log for first few sessions
          if (sortedSessions.indexOf(session) < 3) {
            console.log(`[SessionDropdownSection] Session ${session.id.slice(-8)}: isActive=${isActive}, isSelected=${isSelected}`);
            console.log(`  session.id=${session.id.slice(-20)}, currentSessionId=${currentSessionId?.slice(-20)}`);
            console.log(`  activeSessions=${Array.from(activeSessions).map(s => s.slice(-20))}`);
          }
          
          return (
            <div
              key={session.id}
              className={`${styles.sessionListItem} ${isSelected ? styles.active : ""}`}
              onClick={() => handleSelect(session)}
            >
              <div className={styles.sessionItemContent}>
                <span className={styles.sessionName}>
                  {session.name || `Session ${session.id.slice(-8)}`}
                  {isActive && (
                    <span className={styles.activeIndicator} title="Active session">
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
