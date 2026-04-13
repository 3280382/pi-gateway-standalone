/**
 * SessionDropdownSection - Session dropdown selector
 * 
 * 职责：
 * - 显示所有历史 session 文件列表
 * - 当前选中的 session 是服务器正在使用的 session
 * - 支持切换 session
 * - 紧凑的自定义下拉框样式
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import styles from "./SidebarPanel.module.css";

export function SessionDropdownSection() {
  // ========== 1. State ==========
  const sessions = useSidebarStore((state) => state.sessions);
  const currentSessionId = useSidebarStore((state) => state.selectedSessionId);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const controller = useSidebarController();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ========== 2. Effects ==========
  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ========== 3. Actions ==========
  const handleSelect = useCallback(
    async (session: Session) => {
      await controller.selectSession(session.id);
      setIsOpen(false);
    },
    [controller]
  );

  const handleNewSession = useCallback(async () => {
    await controller.createNewSession();
    setIsOpen(false);
  }, [controller]);

  // ========== 4. Computed ==========
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const displayName = currentSession?.name || currentSessionId?.slice(-8) || "Select";

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
        <button type="button" className={styles.newSessionButton} onClick={handleNewSession}>
          + New
        </button>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Session</h3>
        <button type="button" className={styles.newSessionButton} onClick={handleNewSession}>
          + New
        </button>
      </div>

      <div className={styles.sessionSelector} ref={dropdownRef}>
        <button
          type="button"
          className={styles.selectorBtn}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={styles.selectorValue}>{displayName}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={styles.dropdownIcon}
            style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && (
          <div className={styles.sessionDropdown}>
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`${styles.dropdownItem} ${session.id === currentSessionId ? styles.active : ""}`}
                onClick={() => handleSelect(session)}
              >
                <span className={styles.sessionName}>
                  {session.name || `Session ${session.id.slice(-8)}`}
                </span>
                {session.messageCount > 0 && (
                  <span className={styles.sessionCount}>{session.messageCount}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
