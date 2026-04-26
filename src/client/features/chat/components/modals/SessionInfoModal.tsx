/**
 * SessionInfoModal - Live session info via WebSocket
 */

import { useEffect, useState } from "react";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { websocketService } from "@/services/websocket.service";
import styles from "./Modals.module.css";

interface ToolInfo {
  name: string;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines: string[];
  parameters: Record<string, unknown>;
}

interface SessionInfo {
  systemPrompt: string;
  model: string | null;
  thinkingLevel: string | null;
  tools: ToolInfo[];
  skills: Array<{ name: string; description: string }>;
  agentsFiles: Array<{ path: string; content: string }>;
  agentName: string | null;
  agentId: string | null;
  workingDir: string;
  sessionFile: string | null;
  isLive: boolean;
}

type TabType = "prompt" | "agents" | "skills" | "tools" | "model" | "agent";

function formatSchema(schema: Record<string, unknown>): string {
  if (!schema || typeof schema !== "object") return "(no parameters)";
  try {
    return JSON.stringify(schema, null, 2);
  } catch {
    return String(schema);
  }
}

export function SessionInfoModal() {
  const { isSessionInfoOpen, closeSessionInfo } = useModalStore();
  const currentPath = useWorkspaceStore((s) => s.currentPath);
  const [data, setData] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("prompt");

  useEffect(() => {
    if (!isSessionInfoOpen) {
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Request via WebSocket (routes to the client's viewing session)
    const unsub = websocketService.on("session_info", (payload: any) => {
      unsub();
      setData(payload.data || payload);
      setIsLoading(false);
    });

    const sent = websocketService.send("get_session_info");
    if (!sent) {
      // Fallback to HTTP if WebSocket not available
      websocketService.on("initialized", (initData: any) => {
        unsub();
        const d = initData.data || initData;
        setData({
          systemPrompt: d.systemPrompt || "(no system prompt)",
          model: d.model || null,
          thinkingLevel: d.thinkingLevel || null,
          tools: d.tools || [],
          skills: d.skills || [],
          agentsFiles: d.agentsFiles || [],
          agentName: d.agentName || null,
          agentId: d.agentId || null,
          workingDir: currentPath || "",
          sessionFile: null,
          isLive: false,
        });
        setIsLoading(false);
      });
      websocketService.send("init");
    }
  }, [isSessionInfoOpen, currentPath]);

  const safeSlice = (s: string, n: number) =>
    s.length > n ? s.slice(0, n) + "\n...(truncated)" : s;

  if (!isSessionInfoOpen) return null;

  const render = () => {
    if (isLoading) return <div className={styles.loading}>Loading...</div>;
    if (error)
      return (
        <div className={styles.empty}>
          <p>Error: {error}</p>
        </div>
      );
    if (!data) return <div className={styles.empty}>No data</div>;

    switch (activeTab) {
      case "prompt":
        return (
          <div className={styles.promptSection}>
            <h4>System Prompt {data.isLive ? "(live)" : "(static)"}</h4>
            <pre className={styles.code}>{data.systemPrompt || "(empty)"}</pre>
          </div>
        );

      case "agents":
        return (
          <div className={styles.promptSection}>
            <h4>AGENTS.md Files ({data.agentsFiles?.length || 0})</h4>
            {data.agentsFiles?.map((f, i) => (
              <div key={i} className={styles.fileBlock}>
                <div className={styles.filePath}>{f.path}</div>
                {f.content ? (
                  <pre className={styles.code}>{safeSlice(f.content, 4000)}</pre>
                ) : (
                  <div className={styles.empty}>Content not available</div>
                )}
              </div>
            ))}
            {!data.agentsFiles?.length && <div className={styles.empty}>None loaded</div>}
          </div>
        );

      case "skills":
        return (
          <div className={styles.skillsList}>
            <h4>Active Skills ({data.skills?.length || 0})</h4>
            {data.skills?.map((s: any, i) => (
              <details key={i} className={styles.skillItem}>
                <summary>{s.name}</summary>
                <div className={styles.skillDescription}>{s.description || "No description"}</div>
              </details>
            ))}
            {!data.skills?.length && <div className={styles.empty}>No skills active</div>}
          </div>
        );

      case "tools":
        return (
          <div className={styles.promptSection}>
            <h4>Active Tools ({data.tools?.length || 0})</h4>
            {data.tools?.map((tool, i) => (
              <details key={i} className={styles.toolDetail} open={i === 0}>
                <summary>
                  <strong>{tool.label || tool.name}</strong>
                  {tool.promptSnippet && (
                    <span className={styles.toolSnippet}> — {tool.promptSnippet}</span>
                  )}
                </summary>
                <div className={styles.toolBody}>
                  {tool.description && (
                    <div className={styles.toolSection}>
                      <h5>Description</h5>
                      <p className={styles.toolDescription}>{tool.description}</p>
                    </div>
                  )}
                  {tool.promptGuidelines?.length > 0 && (
                    <div className={styles.toolSection}>
                      <h5>Guidelines</h5>
                      <ul className={styles.toolGuidelines}>
                        {tool.promptGuidelines.map((g, idx) => (
                          <li key={idx}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {tool.parameters && (
                    <div className={styles.toolSection}>
                      <h5>Parameters</h5>
                      <pre className={styles.code}>{formatSchema(tool.parameters)}</pre>
                    </div>
                  )}
                </div>
              </details>
            ))}
            {!data.tools?.length && <div className={styles.empty}>No tools active</div>}
          </div>
        );

      case "model":
        return (
          <div className={styles.promptSection}>
            <h4>Model & Configuration</h4>
            <div className={styles.infoGrid}>
              <div className={styles.infoRow}>
                <span>Model</span>
                <code>{data.model || "N/A"}</code>
              </div>
              <div className={styles.infoRow}>
                <span>Thinking</span>
                <code>{data.thinkingLevel || "N/A"}</code>
              </div>
              <div className={styles.infoRow}>
                <span>Working Dir</span>
                <code>{data.workingDir}</code>
              </div>
              <div className={styles.infoRow}>
                <span>Session</span>
                <code>{data.sessionFile || "N/A"}</code>
              </div>
            </div>
            <h4 style={{ marginTop: 16 }}>Tool Names</h4>
            <div className={styles.toolTags}>
              {(data.tools || []).map((t) => (
                <span key={t.name} className={styles.toolTag}>
                  {t.name}
                </span>
              ))}
              {!data.tools?.length && <span className={styles.empty}>None</span>}
            </div>
          </div>
        );

      case "agent":
        return (
          <div className={styles.promptSection}>
            <h4>Agent</h4>
            {data.agentName ? (
              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <span>Name</span>
                  <code>{data.agentName}</code>
                </div>
                <div className={styles.infoRow}>
                  <span>ID</span>
                  <code>{data.agentId}</code>
                </div>
              </div>
            ) : (
              <div className={styles.empty}>No agent configured for this session.</div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const tabLabels: Record<TabType, string> = {
    prompt: "System Prompt",
    agents: "AGENTS.md",
    skills: "Skills",
    tools: "Tools",
    model: "Model",
    agent: "Agent",
  };

  return (
    <div className={styles.overlay} onClick={closeSessionInfo}>
      <div className={`${styles.modal} ${styles.fullscreen}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Session Info {data?.isLive ? "(live)" : ""}</h3>
          <button type="button" className={styles.closeBtn} onClick={closeSessionInfo}>
            ✕
          </button>
        </div>

        <div className={styles.tabs}>
          {(["prompt", "agents", "skills", "tools", "model", "agent"] as TabType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? styles.activeTab : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <div className={styles.content}>{render()}</div>
      </div>
    </div>
  );
}
