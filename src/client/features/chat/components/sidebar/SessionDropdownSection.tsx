/**
 * SessionDropdownSection - Session dropdown selector
 * 
 * 职责：
 * - 显示所有历史 session 文件列表
 * - 当前选中的 session 是服务器正在使用的 session
 * - 支持切换 session
 */

import { useCallback } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import styles from "./SidebarPanel.module.css";

export function SessionDropdownSection() {
  // ========== 1. State ==========
  const sessions = useSidebarStore((state) => state.sessions);
  const currentSessionId = useSidebarStore((state) => state.selectedSessionId);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const controller = useSidebarController();

  // Debug
  console.log("[SessionDropdownSection] Render:", {
    sessionsCount: sessions.length,
    currentSessionId,
    isLoading,
    sessions: sessions.map(s => ({ id: s.id.slice(-8), name: s.name })),
  });

  // ========== 2. Actions ==========
  const handleSessionChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const sessionId = e.target.value;
      if (sessionId === "__new__") {
        await controller.createNewSession();
      } else if (sessionId) {
        await controller.selectSession(sessionId);
      }
    },
    [controller]
  );

  const handleNewSession = useCallback(() => {
    controller.createNewSession();
  }, [controller]);

  // ========== 3. Render ==========
  if (isLoading && sessions.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Sessions</h3>
        </div>
        <div className={styles.loading}>Loading...</div>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Sessions</h3>
        </div>
        <button type="button" className={styles.newSessionButton} onClick={handleNewSession}>
          New Session
        </button>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Sessions</h3>
        <button type="button" className={styles.newSessionButton} onClick={handleNewSession}>
          New
        </button>
      </div>

      {/* Session dropdown selector */}
      <div className={styles.paramRow}>
        <select
          className={styles.paramSelect}
          value={currentSessionId || sessions[0]?.id || ""}
          onChange={handleSessionChange}
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name || `Session ${session.id.slice(-8)}`}
              {session.messageCount > 0 ? ` (${session.messageCount} msgs)` : ""}
            </option>
          ))}
          <option value="__new__">+ New Session</option>
        </select>
      </div>
    </section>
  );
}
