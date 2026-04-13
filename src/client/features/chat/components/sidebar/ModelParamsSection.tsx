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

  // 找到当前模型的详细信息（支持完整 ID 或短 ID 匹配）
  const findModelById = (id: string | null) => {
    if (!id) return undefined;
    // 首先尝试完整匹配
    let model = availableModels.find((m) => m.id === id);
    if (model) return model;
    // 然后尝试短 ID 匹配（如 "deepseek-reasoner" 匹配 "deepseek/deepseek-reasoner"）
    model = availableModels.find((m) => m.id.endsWith(`/${id}`) || m.id === id);
    if (model) return model;
    // 最后尝试只匹配模型名称部分
    return availableModels.find((m) => {
      const shortId = m.id.split("/").pop();
      return shortId === id || m.id.includes(id);
    });
  };

  const currentModelInfo = findModelById(currentModel);

  // 获取用于下拉框的当前模型 ID（确保格式匹配）
  const effectiveCurrentModel = currentModelInfo?.id || currentModel || availableModels[0]?.id || "";

  console.log("[ModelParamsSection] Debug:", {
    currentModel,
    effectiveCurrentModel,
    foundModelInfo: !!currentModelInfo,
    availableModelsCount: availableModels.length,
  });

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
            value={effectiveCurrentModel}
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
