/**
 * ModelParamsSection - Model parameters display and selection
 *
 * 职责：
 * - 显示当前模型信息
 * - 提供模型下拉框选择
 * - 支持切换模型
 * - 从 WebSocket init 获取模型列表和当前模型
 */

import { useCallback } from "react";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useChatController } from "@/features/chat/services/api/chatApi";
import styles from "./SidebarPanel.module.css";

export function ModelParamsSection() {
  // ========== 1. State ==========
  const currentModel = useSessionStore((state) => state.currentModel);
  const thinkingLevel = useSessionStore((state) => state.thinkingLevel);
  const availableModels = useSessionStore((state) => state.availableModels);
  const chatController = useChatController();

  // ========== 2. Actions ==========
  const handleModelChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newModelId = e.target.value;
      console.log("[ModelParamsSection] Switching model to:", newModelId);
      try {
        await chatController.setModel(newModelId, thinkingLevel || "medium");
        console.log("[ModelParamsSection] Model switched successfully");
      } catch (error) {
        console.error("[ModelParamsSection] Failed to switch model:", error);
      }
    },
    [chatController, thinkingLevel]
  );

  const handleThinkingLevelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      chatController.setThinkingLevel(e.target.value);
    },
    [chatController]
  );

  // ========== 3. Render ==========
  // 如果没有模型列表，显示加载中
  if (availableModels.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Model</h3>
        </div>
        <div className={styles.loading}>Loading models...</div>
      </section>
    );
  }

  // 找到当前模型的详细信息
  const currentModelInfo = availableModels.find((m) => m.id === currentModel);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Model</h3>
      </div>

      <div className={styles.modelParamsCompact}>
        {/* Model selection dropdown */}
        <div className={styles.paramRow}>
          <label className={styles.paramLabel}>Model</label>
          <select
            className={styles.paramSelect}
            value={currentModel || availableModels[0]?.id || ""}
            onChange={handleModelChange}
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        {/* Provider display */}
        <div className={styles.paramRow}>
          <label className={styles.paramLabel}>Provider</label>
          <div className={styles.paramValue}>
            {currentModelInfo?.provider || "-"}
          </div>
        </div>

        {/* Thinking level */}
        <div className={styles.paramRow}>
          <label className={styles.paramLabel}>Thinking</label>
          <select
            className={styles.paramSelect}
            value={thinkingLevel || "medium"}
            onChange={handleThinkingLevelChange}
          >
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Model Info Grid */}
        <div className={styles.modelInfoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Context</span>
            <span className={styles.infoValue}>
              {currentModelInfo?.contextWindow
                ? formatNumber(currentModelInfo.contextWindow)
                : "-"}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Max Out</span>
            <span className={styles.infoValue}>
              {currentModelInfo?.maxTokens
                ? formatNumber(currentModelInfo.maxTokens)
                : "-"}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Reasoning</span>
            <span className={styles.infoValue}>
              {currentModelInfo?.reasoning ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Format number to K/M format
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}
