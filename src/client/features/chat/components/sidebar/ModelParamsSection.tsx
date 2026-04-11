/**
 * ModelParamsSection - 模型参数展示和设置
 * 展示当前工作目录和会话使用的模型参数
 */

import { useCallback, useState } from "react";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useWorkspaceStore } from "@/features/files/stores";
import styles from "./SidebarPanel.module.css";

interface ModelParam {
  key: string;
  label: string;
  value: any;
  type: "string" | "number" | "boolean" | "select" | "readonly";
  options?: string[];
  editable?: boolean;
  description?: string;
}

export function ModelParamsSection() {
  // ========== 1. State ==========
  const workingDir = useSidebarStore((state) => state.workingDir);
  const currentSessionId = useSidebarStore((state) => state.currentSessionId);
  const currentModel = useSessionStore((state) => state.currentModel);
  const models = useSessionStore((state) => state.models);
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>("");

  // ========== 4. Computed ==========
  // 获取当前模型信息
  const currentModelInfo = models.find((m) => m.id === currentModel) || models[0];

  // 模拟模型参数（实际应从API获取）
  const modelParams: ModelParam[] = [
    {
      key: "model",
      label: "模型",
      value: currentModelInfo?.name || currentModel || "未选择",
      type: "select",
      options: models.map((m) => m.id),
      editable: true,
      description: "当前使用的AI模型",
    },
    {
      key: "temperature",
      label: "温度",
      value: 0.7,
      type: "number",
      editable: true,
      description: "控制输出的随机性，0-1之间",
    },
    {
      key: "maxTokens",
      label: "最大令牌数",
      value: currentModelInfo?.maxTokens || 4096,
      type: "number",
      editable: true,
      description: "生成的最大令牌数",
    },
    {
      key: "contextWindow",
      label: "上下文窗口",
      value: currentModelInfo?.contextWindow || 8192,
      type: "readonly",
      description: "模型支持的上下文长度",
    },
    {
      key: "thinkingLevel",
      label: "思考级别",
      value: "medium",
      type: "select",
      options: ["none", "low", "medium", "high"],
      editable: true,
      description: "AI的思考深度",
    },
    {
      key: "streaming",
      label: "流式输出",
      value: true,
      type: "boolean",
      editable: true,
      description: "是否启用流式输出",
    },
  ];

  // ========== 5. Actions ==========
  const handleEditClick = useCallback((param: ModelParam) => {
    if (param.editable) {
      setEditingParam(param.key);
      setEditValue(param.value);
    }
  }, []);

  const handleSave = useCallback(
    (paramKey: string) => {
      // 这里应该调用API保存参数
      console.log(`保存参数 ${paramKey}: ${editValue}`);
      setEditingParam(null);
      // 实际应该更新状态或调用API
    },
    [editValue]
  );

  const handleCancel = useCallback(() => {
    setEditingParam(null);
  }, []);

  // ========== 6. Render ==========
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>模型参数</h3>
        <div className={styles.sectionSubtitle}>
          {workingDir?.path ? `工作目录: ${workingDir.path.split("/").pop()}` : "未选择工作目录"}
          {currentSessionId && ` | 会话: ${currentSessionId.slice(0, 8)}`}
        </div>
      </div>
      <div className={styles.paramsList}>
        {modelParams.map((param) => (
          <div key={param.key} className={styles.paramItem}>
            <div className={styles.paramHeader}>
              <span className={styles.paramLabel}>{param.label}</span>
              {param.description && (
                <span className={styles.paramDescription}>{param.description}</span>
              )}
            </div>
            <div className={styles.paramValue}>
              {editingParam === param.key ? (
                <div className={styles.editContainer}>
                  {param.type === "select" ? (
                    <select
                      className={styles.editSelect}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                    >
                      {param.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : param.type === "boolean" ? (
                    <select
                      className={styles.editSelect}
                      value={editValue ? "true" : "false"}
                      onChange={(e) => setEditValue(e.target.value === "true")}
                    >
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  ) : (
                    <input
                      type={param.type === "number" ? "number" : "text"}
                      className={styles.editInput}
                      value={editValue}
                      onChange={(e) =>
                        setEditValue(
                          param.type === "number" ? parseFloat(e.target.value) : e.target.value
                        )
                      }
                    />
                  )}
                  <div className={styles.editActions}>
                    <button
                      type="button"
                      className={styles.saveButton}
                      onClick={() => handleSave(param.key)}
                    >
                      保存
                    </button>
                    <button type="button" className={styles.cancelButton} onClick={handleCancel}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.valueDisplay}>
                  <span className={styles.valueText}>
                    {typeof param.value === "boolean"
                      ? param.value
                        ? "是"
                        : "否"
                      : String(param.value)}
                  </span>
                  {param.editable && (
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => handleEditClick(param)}
                      title="点击编辑"
                    >
                      编辑
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}