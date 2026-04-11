/**
 * ModelParamsSection - Model parameters display and settings (compact version)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useChatController } from "@/features/chat/services/api/chatApi";
import styles from "./SidebarPanel.module.css";

interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  maxTokens?: number;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ("text" | "image")[];
}

export function ModelParamsSection() {
  // ========== 1. State ==========
  const currentModel = useSessionStore((state) => state.currentModel);
  const thinkingLevel = useSessionStore((state) => state.thinkingLevel);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatController = useChatController();

  // ========== 2. Effects ==========
  useEffect(() => {
    let mounted = true;

    const loadModels = async () => {
      if (!mounted) return;
      setIsLoading(true);
      try {
        const result = await chatController.listModels();
        console.log(
          "[ModelParamsSection] Models loaded:",
          result?.models?.length,
          result?.models?.[0]
        );
        if (mounted && result?.models) {
          setModels(result.models);
        }
      } catch (error) {
        console.error("[ModelParamsSection] Failed to load models:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadModels();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只执行一次

  // Migrate old format model ID to new format
  const migratedCurrentModel = currentModel?.includes("/")
    ? currentModel
    : models.find((m) => m.id.endsWith(`/${currentModel}`))?.id;

  // Get valid model value for select
  const validModelValue = migratedCurrentModel || models[0]?.id || currentModel || "";

  console.log("[ModelParamsSection] Debug:", {
    currentModel,
    migratedCurrentModel,
    validModelValue,
    modelsCount: models.length,
    firstModelId: models[0]?.id,
  });

  // ========== 3. Actions ==========
  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      console.log("[ModelParamsSection] Model selected:", e.target.value);
      chatController.setModel(e.target.value, thinkingLevel || "medium");
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
  const currentModelInfo = models.find((m) => m.id === validModelValue);

  const thinkingOptions = [
    { value: "off", label: "Off" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];

  // Input types display
  const inputTypes = currentModelInfo?.input
    ? currentModelInfo.input.map((t) => (t === "text" ? "Text" : "Image")).join(", ")
    : "Text";

  // ========== 5. Render ==========
  if (isLoading) {
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
        {/* Model selection */}
        <div className={styles.paramRow}>
          <label className={styles.paramLabel}>Model</label>
          <div className={styles.selectWrapper}>
            <select
              className={styles.paramSelect}
              value={validModelValue}
              onChange={handleModelChange}
              disabled={models.length === 0}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
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
            {thinkingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Model info (read-only) */}
        <div className={styles.modelInfoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Provider</span>
            <span className={styles.infoValue}>{currentModelInfo?.provider || "-"}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Context</span>
            <span className={styles.infoValue}>
              {currentModelInfo?.contextWindow ? formatNumber(currentModelInfo.contextWindow) : "-"}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Max Out</span>
            <span className={styles.infoValue}>
              {currentModelInfo?.maxTokens ? formatNumber(currentModelInfo.maxTokens) : "-"}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Input</span>
            <span className={styles.infoValue}>{inputTypes}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Stream</span>
            <span className={styles.infoValue}>On</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Reasoning</span>
            <span className={styles.infoValue}>{currentModelInfo?.reasoning ? "Yes" : "No"}</span>
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
