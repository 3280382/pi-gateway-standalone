/**
 * ModelSelectorModal - 模型选择器
 */

import { useEffect, useState } from "react";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { websocketService } from "@/services/websocket.service";
import styles from "./Modals.module.css";

interface Model {
  id: string;
  name: string;
  provider: string;
}

export function ModelSelectorModal() {
  const { isModelSelectorOpen, closeModelSelector } = useModalStore();
  const { setCurrentModel, currentModel } = useSessionStore();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isModelSelectorOpen) return;

    setLoading(true);
    const unsubscribe = websocketService.on("models_list", (data: any) => {
      setModels(data.models || []);
      setLoading(false);
    });

    websocketService.send("list_models");

    return () => {
      unsubscribe();
    };
  }, [isModelSelectorOpen]);

  const handleSelect = (modelId: string) => {
    setCurrentModel(modelId);
    closeModelSelector();
  };

  if (!isModelSelectorOpen) return null;

  // Group by provider
  const grouped = models.reduce(
    (acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = [];
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<string, Model[]>
  );

  return (
    <div className={styles.overlay} onClick={closeModelSelector}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Select Model</h3>
          <button type="button" className={styles.closeBtn} onClick={closeModelSelector}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.modelList}>
              {Object.entries(grouped).map(([provider, providerModels]) => (
                <div key={provider} className={styles.modelGroup}>
                  <div className={styles.modelGroupHeader}>{provider}</div>
                  {providerModels.map((model) => (
                    <div
                      key={model.id}
                      className={`${styles.modelItem} ${currentModel === model.id ? styles.selected : ""}`}
                      onClick={() => handleSelect(model.id)}
                      data-level={model.id}
                    >
                      <span className={styles.modelName}>{model.name}</span>
                      {currentModel === model.id && <span className={styles.checkmark}>✓</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
