/**
 * ModelParamsSection - Model parameters display (compact readonly version)
 * 
 * 职责：
 * - 显示当前模型信息（只读）
 * - 允许调整思考级别
 * - 从 WebSocket init 获取 currentModel 和 thinkingLevel
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

  // ========== 2. Computed ==========
  // 找到当前模型的完整信息
  const currentModelInfo = availableModels.find((m) => 
    m.id === currentModel || currentModel?.endsWith(m.id)
  );

  // 提取模型名称（去掉 provider 前缀）
  const modelName = currentModel?.split("/").pop() || currentModel || "Unknown";
  const provider = currentModel?.split("/")[0] || "-";

  console.log("[ModelParamsSection] Current model:", {
    currentModel,
    modelName,
    provider,
    hasInfo: !!currentModelInfo,
  });

  // ========== 3. Actions ==========
  const handleThinkingLevelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      chatController.setThinkingLevel(e.target.value);
    },
    [chatController]
  );

  // ========== 4. Render ==========
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Model</h3>
      </div>

      <div className={styles.modelParamsCompact}>
        {/* Current Model Display (Readonly) */}
        <div className={styles.paramRow}>
          <label className={styles.paramLabel}>Model</label>
          <div className={styles.modelValue} title={currentModel || undefined}>
            {modelName}
          </div>
        </div>

        {/* Provider */}
        <div className={styles.paramRow}>
          <label className={styles.paramLabel}>Provider</label>
          <div className={styles.paramValue}>{provider}</div>
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
