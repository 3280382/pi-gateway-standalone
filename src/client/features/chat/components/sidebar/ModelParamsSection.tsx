/**
 * ModelParamsSection - 模型参数展示和设置
 * 展示当前工作目录和会话使用的模型参数
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useWorkspaceStore } from "@/features/files/stores";
import { useChatController } from "@/features/chat/services/api/chatApi";
import styles from "./SidebarPanel.module.css";

interface ModelParam {
  key: string;
  label: string;
  value: any;
  type: "string" | "number" | "boolean" | "select" | "readonly";
  options?: string[];
  editable?: boolean;
  description?: string;
  min?: number;
  max?: number;
}

// 格式化令牌数量为可读格式
function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  description?: string;
  maxTokens?: number;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ("text" | "image")[];
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  compat?: any;
}

export function ModelParamsSection() {
  // ========== 1. State ==========
  const workingDir = useSidebarStore((state) => state.workingDir);
  const currentSessionId = useSidebarStore((state) => state.currentSessionId);
  const currentModel = useSessionStore((state) => state.currentModel);
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const thinkingLevel = useSessionStore((state) => state.thinkingLevel);
  const chatController = useChatController();

  // ========== 2. Effects ==========
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // 防止重复请求
    if (hasFetchedRef.current) return;

    const loadModels = async () => {
      hasFetchedRef.current = true;
      setIsLoadingModels(true);
      try {
        const result = await chatController.listModels();
        if (result && result.models) {
          setModels(result.models);
        }
      } catch (error) {
        console.error("[ModelParamsSection] Failed to load models:", error);
        hasFetchedRef.current = false; // 出错时允许重试
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, [chatController]);

  // ========== 4. Computed ==========
  // 获取当前模型信息
  const currentModelInfo = models.find((m) => m.id === currentModel) || models[0];

  // 使用 useMemo 缓存模型参数，避免不必要的重新计算
  const modelParams = useMemo(() => {
    return [
      {
        key: "model",
        label: "模型",
        value: currentModelInfo?.name || currentModel || "未选择",
        type: "select" as const,
        options: models.map((m) => m.id),
        editable: true,
        description: "当前使用的AI模型",
      },
      {
        key: "provider",
        label: "提供商",
        value: currentModelInfo?.provider || "未知",
        type: "readonly" as const,
        description: "模型服务提供商",
      },
      {
        key: "contextWindow",
        label: "上下文窗口",
        value: currentModelInfo?.contextWindow || 8192,
        type: "readonly" as const,
        description: `模型支持的上下文长度（${currentModelInfo?.contextWindow ? formatTokenCount(currentModelInfo.contextWindow) : "未知"}）`,
      },
      {
        key: "maxTokens",
        label: "最大输出",
        value: currentModelInfo?.maxTokens || 4096,
        type: "number" as const,
        editable: true,
        min: 1,
        max: currentModelInfo?.contextWindow || 8192,
        description: `生成的最大令牌数（最大: ${currentModelInfo?.maxTokens ? formatTokenCount(currentModelInfo.maxTokens) : "未知"}）`,
      },
      {
        key: "reasoning",
        label: "推理能力",
        value: currentModelInfo?.reasoning ? "支持" : "不支持",
        type: "readonly" as const,
        description: "模型是否支持推理/思考",
      },
      {
        key: "inputTypes",
        label: "输入类型",
        value: currentModelInfo?.input ? currentModelInfo.input.join(", ") : "文本",
        type: "readonly" as const,
        description: "模型支持的输入类型",
      },
      {
        key: "thinkingLevel",
        label: "思考级别",
        value: thinkingLevel || "medium",
        type: "select" as const,
        options: ["off", "low", "medium", "high"],
        editable: true,
        description: "AI的思考深度（仅支持推理的模型有效）",
      },
      {
        key: "streaming",
        label: "流式输出",
        value: true,
        type: "boolean" as const,
        editable: true,
        description: "是否启用流式输出",
      },
    ];
  }, [models, currentModel, currentModelInfo, thinkingLevel]);



  // ========== 5. Actions ==========
  const handleEditClick = useCallback((param: ModelParam) => {
    if (param.editable) {
      setEditingParam(param.key);
      setEditValue(param.value);
    }
  }, []);

  const handleSave = useCallback(
    (paramKey: string) => {
      const param = modelParams.find((p) => p.key === paramKey);
      if (!param) return;

      console.log(`保存参数 ${paramKey}: ${editValue}`);
      
      // 根据参数类型执行不同的保存操作
      switch (paramKey) {
        case "model":
          // 切换模型
          chatController.setModel(editValue);
          break;
        case "maxTokens":
          // 设置最大令牌数（这里需要调用相应的API）
          console.log(`设置最大令牌数为: ${editValue}`);
          break;
        case "thinkingLevel":
          // 设置思考级别
          chatController.setThinkingLevel(editValue);
          break;
        case "streaming":
          // 设置流式输出（这里需要调用相应的API）
          console.log(`设置流式输出为: ${editValue}`);
          break;
        default:
          console.log(`参数 ${paramKey} 的保存逻辑未实现`);
      }
      
      setEditingParam(null);
    },
    [editValue, modelParams, chatController]
  );

  const handleCancel = useCallback(() => {
    setEditingParam(null);
  }, []);

  // ========== 6. Render ==========
  // 如果正在加载模型，显示加载状态
  if (isLoadingModels) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>模型参数</h3>
        </div>
        <div className={styles.loading}>加载模型中...</div>
      </section>
    );
  }

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
                      min={param.min}
                      max={param.max}
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