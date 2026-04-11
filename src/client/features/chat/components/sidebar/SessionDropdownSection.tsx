/**
 * SessionDropdownSection - Session dropdown selector
 * Uses custom dropdown menu, consistent with top model selector style
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ========== 2. Effects ==========
  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ========== 5. Actions ==========
  const handleSessionSelect = useCallback(
    (sessionId: string) => {
      controller.selectSession(sessionId);
      setIsDropdownOpen(false);
    },
    [controller]
  );

  const handleNewSession = useCallback(() => {
    controller.createNewSession();
    setIsDropdownOpen(false);
  }, [controller]);

  // Get current selected session
  const currentSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];
  const currentSessionName = currentSession?.name || "Select session";

  // ========== 6. Render ==========
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

      {/* Custom dropdown selector */}
      <div className={styles.sessionSelector} ref={dropdownRef}>
        <button
          type="button"
          className={styles.selectorBtn}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          title="Select session"
        >
          <span className={styles.selectorValue}>
            {currentSessionName.length > 20
              ? `${currentSessionName.slice(0, 20)}...`
              : currentSessionName}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={styles.dropdownIcon}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className={styles.sessionDropdown}>
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`${styles.dropdownItem} ${session.id === currentSessionId ? styles.active : ""}`}
                onClick={() => handleSessionSelect(session.id)}
              >
                <span className={styles.sessionName}>
                  {session.name || `Session ${session.id.slice(0, 8)}`}
                </span>
                {session.messageCount !== undefined && (
                  <span className={styles.sessionCount}>{session.messageCount} msgs</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
