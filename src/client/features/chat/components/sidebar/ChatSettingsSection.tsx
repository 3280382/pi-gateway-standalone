/**
 * ChatSettingsSection - 聊天设置部分
 * 包含系统设置、LLM日志、调试工具等
 */

import { useCallback } from "react";
import { useLlmLogStore } from "@/features/chat/stores/llmLogStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import styles from "./SidebarPanel.module.css";

export function ChatSettingsSection() {
  const toggleLlmLog = useLlmLogStore((state) => state.toggleLlmLog);
  const isLlmLogVisible = useLlmLogStore((state) => state.isVisible);
  const openModal = useModalStore((state) => state.openModal);

  const handleOpenSettings = useCallback(() => {
    openModal("settings");
  }, [openModal]);

  const handleOpenDebug = useCallback(() => {
    openModal("debug");
  }, [openModal]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>设置</h3>
      </div>
      <div className={styles.settingsList}>
        <button type="button" className={styles.settingItem} onClick={handleOpenSettings}>
          <span className={styles.settingLabel}>⚙️ 系统设置</span>
        </button>
        <button type="button" className={styles.settingItem} onClick={toggleLlmLog}>
          <span className={styles.settingLabel}>
            {isLlmLogVisible ? "📊 隐藏LLM日志" : "📊 显示LLM日志"}
          </span>
        </button>
        <button type="button" className={styles.settingItem} onClick={handleOpenDebug}>
          <span className={styles.settingLabel}>🐛 调试工具</span>
        </button>
      </div>
    </section>
  );
}