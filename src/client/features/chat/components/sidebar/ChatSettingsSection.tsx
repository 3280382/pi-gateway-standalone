/**
 * ChatSettingsSection - Chat settings section
 * Contains LLM log configuration
 */

import { useCallback } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useLlmLogStore } from "@/features/chat/stores/llmLogStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import styles from "./SidebarPanel.module.css";

export function ChatSettingsSection() {
  // ========== 1. State ==========
  const llmLogConfig = useLlmLogStore((state) => state.config);
  const setLlmLogConfig = useLlmLogStore((state) => state.setConfig);
  const openLlmLogModal = useLlmLogStore((state) => state.openModal);

  // Message limit setting (unified in workspaceStore)
  const defaultMessageLimit = useWorkspaceStore((state) => state.defaultMessageLimit);
  const setDefaultMessageLimit = useWorkspaceStore((state) => state.setDefaultMessageLimit);

  // Smart content recognition
  const smartContentRecognition = useChatStore((state) => state.smartContentRecognition);
  const toggleSmartContentRecognition = useChatStore(
    (state) => state.toggleSmartContentRecognition
  );

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

  const handleMessageLimitChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = Number(e.target.value);
      setDefaultMessageLimit(value);
    },
    [setDefaultMessageLimit]
  );

  // ========== 3. Render ==========
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Settings</h3>
      </div>

      {/* Smart Content Recognition toggle */}
      <div className={styles.setting}>
        <span className={styles.label}>Smart</span>
        <button
          type="button"
          className={`${styles.toggleBtn} ${smartContentRecognition ? styles.enabled : ""}`}
          onClick={toggleSmartContentRecognition}
          title={smartContentRecognition ? "Smart recognition on" : "Smart recognition off"}
        >
          <SmartIcon />
          <span>{smartContentRecognition ? "On" : "Off"}</span>
        </button>
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

      {/* Message limit setting */}
      <div className={styles.setting}>
        <span className={styles.label}>Messages</span>
        <select
          className={styles.select}
          value={defaultMessageLimit}
          onChange={handleMessageLimitChange}
          title="Default number of history messages to load (-1 means load all)"
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
          <option value={-1}>All</option>
        </select>
      </div>
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

function SmartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <title>Smart recognition</title>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
