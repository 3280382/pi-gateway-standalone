/**
 * SystemPromptModal - 系统提示查看器
 *
 * Responsibilities:
 * - 显示系统提示、AGENTS.md、Skills、Extensions、Resources
 * - 通过Tab切换不同内容视图
 *
 * Structure:State → Ref → Effects → Computed → Actions → Render
 */

import { useEffect, useState } from "react";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import styles from "./Modals.module.css";

// ============================================================================
// Types
// ============================================================================

interface SystemPromptData {
  systemPrompt?: string;
  appendSystemPrompt?: Array<{ path: string; content: string }>;
  skills?: Array<{ name: string; description: string }>;
  agentsFiles?: Array<{ path: string; content: string }>;
  extensions?: Array<{
    name: string;
    version: string;
    description: string;
    enabled: boolean;
  }>;
  cwd?: string;
}

type TabType = "prompt" | "agents" | "skills" | "resources" | "extensions";

// ============================================================================
// Component
// ============================================================================

export function SystemPromptModal() {
  // ========== 1. State ==========
  // Domain State
  const { isSystemPromptOpen, closeSystemPrompt } = useModalStore();
  const resourceFiles = useSessionStore((state) => state.resourceFiles);
  // 使用全局 workspaceStore 的 currentPath
  const currentPath = useWorkspaceStore((state) => state.currentPath);

  // UI State
  const [data, setData] = useState<SystemPromptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("prompt");

  // ========== 3. Effects ==========
  useEffect(() => {
    if (!isSystemPromptOpen) {
      setData(null);
      setError(null);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch system prompt data
        const cwd = currentPath || "/root";
        const res = await fetch(`/api/system-prompt?cwd=${encodeURIComponent(cwd)}`);

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const json = await res.json();

        // Fetch extensions data
        let extensions: Array<{
          name: string;
          version: string;
          description: string;
          enabled: boolean;
        }> = [];

        try {
          const extRes = await fetch("/api/extensions");
          if (extRes.ok) {
            const extJson = await extRes.json();
            extensions = extJson.extensions || [];
            console.log("[SystemPromptModal] Extensions loaded:", extensions.length);
          }
        } catch (e) {
          console.log("[SystemPromptModal] Extensions API not available:", e);
        }

        console.log("[SystemPromptModal] Data loaded:", {
          skills: json.skills?.length,
          extensions: extensions.length,
          resourceFiles: resourceFiles ? "available" : "null",
        });

        setData({ ...json, extensions });
      } catch (err) {
        console.error("[SystemPromptModal] Failed to load:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isSystemPromptOpen, currentPath, resourceFiles]);

  if (!isSystemPromptOpen) return null;

  const renderContent = () => {
    if (isLoading) {
      return <div className={styles.loading}>Loading...</div>;
    }

    if (error) {
      return (
        <div className={styles.empty}>
          <p>Error: {error}</p>
        </div>
      );
    }

    if (!data) {
      return <div className={styles.empty}>No data available</div>;
    }

    switch (activeTab) {
      case "prompt":
        return (
          <div className={styles.promptSection}>
            <h4>⚙️ System Prompt</h4>
            <pre className={styles.code}>{data.systemPrompt || "No system prompt loaded"}</pre>
            {data.appendSystemPrompt && data.appendSystemPrompt.length > 0 && (
              <>
                <h4>➕ Append System Prompt ({data.appendSystemPrompt.length})</h4>
                {data.appendSystemPrompt.map((file, i) => (
                  <div key={i} className={styles.fileBlock}>
                    <div className={styles.filePath}>{file.path}</div>
                    <pre className={styles.code}>{file.content}</pre>
                  </div>
                ))}
              </>
            )}
          </div>
        );

      case "agents":
        return (
          <div className={styles.promptSection}>
            <h4>📄 AGENTS.md Files ({data.agentsFiles?.length || 0})</h4>
            {data.agentsFiles?.map((file, i) => (
              <div key={i} className={styles.fileBlock}>
                <div className={styles.filePath}>{file.path}</div>
                <pre className={styles.code}>{file.content}</pre>
              </div>
            ))}
            {!data.agentsFiles?.length && (
              <div className={styles.empty}>No AGENTS.md files found</div>
            )}
          </div>
        );

      case "skills":
        return (
          <div className={styles.skillsList}>
            {data.skills?.map((skill, i) => (
              <details key={i} className={styles.skillItem}>
                <summary>{skill.name}</summary>
                <div className={styles.skillDescription}>{skill.description}</div>
              </details>
            ))}
            {!data.skills?.length && <div className={styles.empty}>No skills loaded</div>}
          </div>
        );

      case "extensions":
        console.log("[SystemPromptModal] Rendering extensions:", data.extensions);
        return (
          <div className={styles.extensionsList}>
            {data.extensions && data.extensions.length > 0 ? (
              data.extensions.map((ext, i) => (
                <div key={i} className={styles.extensionItem}>
                  <div className={styles.extensionHeader}>
                    <span className={styles.extensionName}>{ext.name}</span>
                    <span className={styles.extensionVersion}>v{ext.version}</span>
                    <span
                      className={`${styles.extensionStatus} ${ext.enabled ? styles.enabled : styles.disabled}`}
                    >
                      {ext.enabled ? "●" : "○"}
                    </span>
                  </div>
                  <div className={styles.extensionDescription}>{ext.description}</div>
                </div>
              ))
            ) : (
              <div className={styles.empty}>
                <p>No extensions installed</p>
                <p className={styles.emptyNote}>Install extensions to .pi/extensions directory</p>
              </div>
            )}
          </div>
        );

      case "resources":
        console.log("[SystemPromptModal] Rendering resources:", resourceFiles);
        if (!resourceFiles) {
          return (
            <div className={styles.empty}>
              <p>No resource files loaded</p>
              <p className={styles.emptyNote}>
                Resource files will be loaded after WebSocket connection is established. Please wait
                a moment and reopen this dialog.
              </p>
            </div>
          );
        }
        return (
          <div className={styles.promptSection}>
            <h4>📁 Resource Files</h4>
            <div className={styles.resourceSection}>
              <h5>System Prompt</h5>
              <div className={styles.filePath}>
                <span className={styles.label}>Global:</span>
                <code>{resourceFiles.systemPrompt?.global || "N/A"}</code>
                {resourceFiles.systemPrompt?.global && resourceFiles.systemPrompt?.global !== "None"
                  ? " ✓"
                  : " ✗"}
              </div>
              <div className={styles.filePath}>
                <span className={styles.label}>Project:</span>
                <code>{resourceFiles.systemPrompt?.project || "N/A"}</code>
                {resourceFiles.systemPrompt?.project &&
                resourceFiles.systemPrompt?.project !== "None"
                  ? " ✓"
                  : " ✗"}
              </div>
            </div>

            <div className={styles.resourceSection}>
              <h5>Configuration</h5>
              <div className={styles.filePath}>
                <span className={styles.label}>Settings:</span>
                <code>{resourceFiles.settings?.path || "N/A"}</code>
                {resourceFiles.settings?.exists ? " ✓" : " ✗"}
              </div>
              <div className={styles.filePath}>
                <span className={styles.label}>Auth:</span>
                <code>{resourceFiles.auth?.path || "N/A"}</code>
                {resourceFiles.auth?.exists ? " ✓" : " ✗"}
              </div>
            </div>

            {resourceFiles.agentsFiles && resourceFiles.agentsFiles.length > 0 && (
              <div className={styles.resourceSection}>
                <h5>AGENTS.md Files ({resourceFiles.agentsFiles.length})</h5>
                {resourceFiles.agentsFiles.map((f, i) => (
                  <div key={i} className={styles.filePath}>
                    <code>{f.path}</code>
                    {f.exists ? " ✓" : " ✗"}
                  </div>
                ))}
              </div>
            )}

            {resourceFiles.skills?.loaded && resourceFiles.skills.loaded.length > 0 && (
              <div className={styles.resourceSection}>
                <h5>Skills ({resourceFiles.skills.loaded.length})</h5>
                <div className={styles.skillList}>
                  {resourceFiles.skills.loaded.map((skill, i) => (
                    <div key={i} className={styles.skillTag}>
                      {skill.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ========== 6. Render ==========
  return (
    <div className={styles.overlay} onClick={closeSystemPrompt}>
      <div className={`${styles.modal} ${styles.fullscreen}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>System Prompt & AGENTS.md</h3>
          <button type="button" className={styles.closeBtn} onClick={closeSystemPrompt}>
            ✕
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={activeTab === "prompt" ? styles.activeTab : ""}
            onClick={() => setActiveTab("prompt")}
          >
            System Prompt
          </button>
          <button
            type="button"
            className={activeTab === "agents" ? styles.activeTab : ""}
            onClick={() => setActiveTab("agents")}
          >
            AGENTS.md ({data?.agentsFiles?.length || 0})
          </button>
          <button
            type="button"
            className={activeTab === "skills" ? styles.activeTab : ""}
            onClick={() => setActiveTab("skills")}
          >
            Skills ({data?.skills?.length || 0})
          </button>
          <button
            type="button"
            className={activeTab === "extensions" ? styles.activeTab : ""}
            onClick={() => setActiveTab("extensions")}
          >
            Extensions ({data?.extensions?.length || 0})
          </button>
          <button
            type="button"
            className={activeTab === "resources" ? styles.activeTab : ""}
            onClick={() => setActiveTab("resources")}
          >
            Resources
          </button>
        </div>

        <div className={styles.content}>{renderContent()}</div>
      </div>
    </div>
  );
}
