/**
 * ChatSettingsSection - Chat settings section
 * Contains LLM log configuration
 */

import { useCallback } from "react";
import { useLlmLogStore } from "@/features/chat/stores/llmLogStore";
import styles from "./SidebarPanel.module.css";

export function ChatSettingsSection() {
  // ========== 1. State ==========
  const llmLogConfig = useLlmLogStore((state) => state.config);
  const setLlmLogConfig = useLlmLogStore((state) => state.setConfig);
  const openLlmLogModal = useLlmLogStore((state) => state.openModal);

  // ========== 2. Actions ==========
  const handleToggleLlmLog = useCallback(() => {
    setLlmLogConfig({ enabled: !llmLogConfig.enabled });
  }, [llmLogConfig.enabled, setLlmLogConfig]);

  const handleRefreshIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setLlmLogConfig({ refreshInterval: Number(e.target.value) });
    },
    [setLlmLogConfig]
  );

  // ========== 3. Render ==========
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Settings</h3>
      </div>

      {/* LLM Log configuration */}
      <div className={styles.setting}>
        <span className={styles.label}>LLM Log</span>
        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${llmLogConfig.enabled ? styles.enabled : ""}`}
            onClick={handleToggleLlmLog}
            title={llmLogConfig.enabled ? "Log enabled" : "Log disabled"}
          >
            <LogIcon />
            <span>{llmLogConfig.enabled ? "On" : "Off"}</span>
          </button>
          <button
            type="button"
            className={styles.viewBtn}
            onClick={openLlmLogModal}
            title="View LLM Logs"
          >
            <ViewIcon />
          </button>
        </div>
      </div>

      {/* Refresh interval - only shown when LLM Log is enabled */}
      {llmLogConfig.enabled && (
        <div className={styles.setting}>
          <span className={styles.label}>Refresh</span>
          <select
            className={styles.select}
            value={llmLogConfig.refreshInterval}
            onChange={handleRefreshIntervalChange}
          >
            <option value={1}>1s</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1min</option>
          </select>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Icons
// ============================================================================

function LogIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
