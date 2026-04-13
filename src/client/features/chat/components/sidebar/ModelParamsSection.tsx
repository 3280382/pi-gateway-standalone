/**
 * ModelParamsSection - Model parameters display and selection
 *
 * 职责：
 * - 显示当前模型信息
 * - 提供模型下拉框选择
 * - 支持切换模型
 * - 紧凑的自定义下拉框样式
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useChatController } from "@/features/chat/services/api/chatApi";
import styles from "./SidebarPanel.module.css";

export function ModelParamsSection() {
  // ========== 1. State ==========
  const currentModel = useSessionStore((state) => state.currentModel);
  const thinkingLevel = useSessionStore((state) => state.thinkingLevel);
  const availableModels = useSessionStore((state) => state.availableModels);
  const chatController = useChatController();
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // ========== 2. Effects ==========
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ========== 3. Actions ==========
  const handleModelSelect = useCallback(
    async (modelId: string) => {
      console.log("[ModelParamsSection] Switching model to:", modelId);
      try {
        await chatController.setModel(modelId, thinkingLevel || "medium");
        setIsModelOpen(false);
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

  // ========== 4. Computed ==========
  const currentModelInfo = availableModels.find((m) => {
    if (!currentModel) return false;
    return m.id === currentModel || m.id.endsWith(`/${currentModel}`) || currentModel.endsWith(m.id);
  });

  const displayModelName = currentModelInfo?.name || currentModel?.split("/").pop() || "Select";

  // ========== 5. Render ==========
  if (availableModels.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Model</h3>
        </div>
        <div className={styles.loading}>Loading...</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Model</h3>
      </div>

      <div className={styles.modelParamsCompact}>
        {/* Model selection dropdown */}
        <div className={styles.paramRow}>
          <label className={styles.paramLabel}>Model</label>
          <div className={styles.sessionSelector} ref={modelDropdownRef}>
            <button
              type="button"
              className={styles.selectorBtn}
              onClick={() => setIsModelOpen(!isModelOpen)}
            >
              <span className={styles.selectorValue}>{displayModelName}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className={styles.dropdownIcon}
                style={{ transform: isModelOpen ? "rotate(180deg)" : "none" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isModelOpen && (
              <div className={styles.sessionDropdown}>
                {availableModels.map((model) => (
                  <div
                    key={model.id}
                    className={`${styles.dropdownItem} ${model.id === currentModelInfo?.id ? styles.active : ""}`}
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <span className={styles.sessionName}>{model.name}</span>
                    <span className={styles.sessionCount}>{model.provider}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
