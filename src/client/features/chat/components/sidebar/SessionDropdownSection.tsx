/**
 * SessionDropdownSection - 会话下拉选择
 * 使用下拉列表选择会话，默认显示最近一个
 */

import { useCallback, useEffect, useState } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import styles from "./SidebarPanel.module.css";

export function SessionDropdownSection() {
  // ========== 1. State ==========
  const sessions = useSidebarStore((state) => state.sessions);
  const currentSessionId = useSidebarStore((state) => state.currentSessionId);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const controller = useSidebarController();
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // ========== 2. Effects ==========
  useEffect(() => {
    // 设置默认选中的会话（最近一个或当前会话）
    if (sessions.length > 0) {
      if (currentSessionId) {
        setSelectedSessionId(currentSessionId);
      } else {
        // 默认选择最近创建的会话（假设按时间排序，第一个是最新的）
        setSelectedSessionId(sessions[0].id);
      }
    }
  }, [sessions, currentSessionId]);

  // ========== 5. Actions ==========
  const handleSessionChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const sessionId = event.target.value;
      setSelectedSessionId(sessionId);
      if (sessionId) {
        controller.switchSession(sessionId);
      }
    },
    [controller]
  );

  const handleNewSession = useCallback(() => {
    controller.createNewSession();
  }, [controller]);

  // ========== 6. Render ==========
  if (isLoading && sessions.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>会话</h3>
        </div>
        <div className={styles.loading}>加载中...</div>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>会话</h3>
        </div>
        <button type="button" className={styles.newSessionButton} onClick={handleNewSession}>
          新建会话
        </button>
      </section>
    );
  }

  // 获取当前选中的会话
  const currentSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0];

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>会话</h3>
        <button type="button" className={styles.newSessionButton} onClick={handleNewSession}>
          新建
        </button>
      </div>
      <div className={styles.dropdownContainer}>
        <select
          className={styles.sessionDropdown}
          value={selectedSessionId}
          onChange={handleSessionChange}
          title="选择会话"
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name || `会话 ${session.id.slice(0, 8)}`}
            </option>
          ))}
        </select>
        {currentSession && (
          <div className={styles.sessionInfo}>
            <div className={styles.sessionMeta}>
              <span className={styles.sessionDate}>
                {new Date(currentSession.createdAt).toLocaleDateString()}
              </span>
              <span className={styles.sessionModel}>{currentSession.model || "默认模型"}</span>
            </div>
            {currentSession.description && (
              <div className={styles.sessionDescription}>{currentSession.description}</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}