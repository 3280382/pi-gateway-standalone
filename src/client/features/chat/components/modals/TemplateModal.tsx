/**
 * TemplateModal - Compact Prompt Template Browser
 *
 * Features:
 * - Compact header with minimal controls
 * - Collapsible sidebar for template selection
 * - Maximized preview area
 * - Clean, modern design
 */

import { useEffect, useState, useCallback } from "react";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { websocketService } from "@/services/websocket.service";
import styles from "./TemplateModal.module.css";

const HOME_DIR = "/root";

interface Template {
  name: string;
  source: "global" | "local";
  path: string;
}

interface TemplateModalProps {
  onTemplateSelect?: (content: string) => void;
}

export function TemplateModal({ onTemplateSelect }: TemplateModalProps) {
  const { isTemplateModalOpen, closeTemplateModal } = useModalStore();
  const workingDir = useWorkspaceStore((state) => state.workingDir) ?? "/root";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filter, setFilter] = useState<"all" | "global" | "local">("all");

  // WebSocket listeners
  useEffect(() => {
    if (!isTemplateModalOpen) return;

    if (!websocketService.isConnected) {
      setError("Not connected");
      setLoading(false);
      return;
    }

    const unsubList = websocketService.on("templates_list", (data: any) => {
      const list = data.templates || [];
      setTemplates(list);
      setLoading(false);
      if (list.length > 0 && !selectedTemplate) {
        setSelectedTemplate(list[0]);
        loadTemplate(list[0].name);
      }
    });

    const unsubContent = websocketService.on("template_content", (data: any) => {
      setPreviewContent(data.content || "");
      setPreviewLoading(false);
    });

    const unsubError = websocketService.on("error", (data: any) => {
      if (data.messageType?.includes("template")) {
        setError(data.error || "Failed to load");
        setLoading(false);
        setPreviewLoading(false);
      }
    });

    return () => {
      unsubList();
      unsubContent();
      unsubError();
    };
  }, [isTemplateModalOpen, selectedTemplate]);

  // Load templates on open
  useEffect(() => {
    if (!isTemplateModalOpen) return;
    if (!websocketService.isConnected) {
      setError("Not connected");
      return;
    }
    setLoading(true);
    setError(null);
    setTemplates([]);
    setSelectedTemplate(null);
    setPreviewContent("");
    websocketService.send("list_templates");
  }, [isTemplateModalOpen]);

  const loadTemplate = useCallback((name: string) => {
    if (!websocketService.isConnected) return;
    setPreviewLoading(true);
    websocketService.send("get_template", { name });
  }, []);

  const handleSelect = useCallback((template: Template) => {
    setSelectedTemplate(template);
    loadTemplate(template.name);
  }, [loadTemplate]);

  const handleInsert = useCallback(() => {
    if (onTemplateSelect && previewContent) {
      onTemplateSelect(previewContent);
    }
    closeTemplateModal();
  }, [onTemplateSelect, previewContent, closeTemplateModal]);

  if (!isTemplateModalOpen) return null;

  const filtered = templates.filter((t) =>
    filter === "all" ? true : t.source === filter
  );

  return (
    <div className={styles.overlay} onClick={closeTemplateModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Compact Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Templates</span>
            <span className={styles.count}>{templates.length}</span>
          </div>

          <div className={styles.headerCenter}>
            <select
              className={styles.filterSelect}
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="global">Global</option>
              <option value="local">Local</option>
            </select>
          </div>

          <div className={styles.headerRight}>
            <button
              className={styles.iconBtn}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {sidebarCollapsed ? "☰" : "✕"}
            </button>
            <button className={styles.closeBtn} onClick={closeTemplateModal}>
              ✕
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.content}>
          {/* Sidebar - Collapsible */}
          {!sidebarCollapsed && (
            <div className={styles.sidebar}>
              {loading ? (
                <div className={styles.loading}>Loading...</div>
              ) : error ? (
                <div className={styles.error}>{error}</div>
              ) : templates.length === 0 ? (
                <div className={styles.empty}>
                  <p>No templates</p>
                  <span className={styles.hint}>
                    Create .md in ~/.pi/agent/prompts/
                  </span>
                </div>
              ) : (
                <div className={styles.list}>
                  {filtered.map((t) => (
                    <div
                      key={t.path}
                      className={`${styles.item} ${
                        selectedTemplate?.path === t.path ? styles.active : ""
                      }`}
                      onClick={() => handleSelect(t)}
                      title={t.path}
                    >
                      <span className={`${styles.badge} ${styles[t.source]}`}>
                        {t.source[0].toUpperCase()}
                      </span>
                      <span className={styles.name}>{t.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preview Area */}
          <div className={styles.preview}>
            {selectedTemplate ? (
              <>
                <div className={styles.previewHeader}>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>
                      {selectedTemplate.name}
                    </span>
                    <span className={`${styles.tag} ${styles[selectedTemplate.source]}`}>
                      {selectedTemplate.source}
                    </span>
                  </div>
                  <div className={styles.stats}>
                    {previewContent && (
                      <>
                        <span>{previewContent.length}c</span>
                        <span>{previewContent.split(/\s+/).filter(Boolean).length}w</span>
                        <span>{previewContent.split("\n").length}l</span>
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.previewBody}>
                  {previewLoading ? (
                    <div className={styles.spinnerBox}>
                      <div className={styles.spinner} />
                    </div>
                  ) : (
                    <pre className={styles.code}>
                      <code>{previewContent}</code>
                    </pre>
                  )}
                </div>

                <div className={styles.previewFooter}>
                  <span className={styles.path}>{selectedTemplate.path}</span>
                  <div className={styles.actions}>
                    <button className={styles.btnSecondary} onClick={closeTemplateModal}>
                      Cancel
                    </button>
                    <button
                      className={styles.btnPrimary}
                      onClick={handleInsert}
                      disabled={!previewContent || previewLoading}
                    >
                      Insert
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.placeholder}>
                <span>Select a template</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
