/**
 * TemplateModal - Compact dropdown-based template selector
 *
 * Features:
 * - No sidebar, uses compact dropdown for selection
 * - Maximized content preview area
 * - Clean, minimal design
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

  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    const template = templates.find((t) => t.name === name);
    if (template) {
      setSelectedTemplate(template);
      loadTemplate(template.name);
    }
  }, [templates, loadTemplate]);

  const handleInsert = useCallback(() => {
    if (onTemplateSelect && previewContent) {
      onTemplateSelect(previewContent);
    }
    closeTemplateModal();
  }, [onTemplateSelect, previewContent, closeTemplateModal]);

  if (!isTemplateModalOpen) return null;

  return (
    <div className={styles.overlay} onClick={closeTemplateModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Compact Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Template</span>
            {templates.length > 0 && (
              <select
                className={styles.templateSelect}
                value={selectedTemplate?.name || ""}
                onChange={handleSelectChange}
                disabled={loading}
              >
                {templates.map((t) => (
                  <option key={t.path} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {selectedTemplate && (
              <span className={`${styles.badge} ${styles[selectedTemplate.source]}`}>
                {selectedTemplate.source}
              </span>
            )}
          </div>

          <div className={styles.headerRight}>
            <button className={styles.closeBtn} onClick={closeTemplateModal}>
              ✕
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.centerMessage}>Loading templates...</div>
          ) : error ? (
            <div className={styles.centerMessage} style={{ color: "#f85149" }}>
              {error}
            </div>
          ) : templates.length === 0 ? (
            <div className={styles.centerMessage}>
              <p>No templates found</p>
              <span className={styles.hint}>
                Create .md files in ~/.pi/agent/prompts/
              </span>
            </div>
          ) : (
            <>
              {/* Preview */}
              <div className={styles.preview}>
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

              {/* Footer */}
              <div className={styles.footer}>
                <div className={styles.footerLeft}>
                  {selectedTemplate && (
                    <>
                      <span className={styles.fileName}>
                        {selectedTemplate.name}
                      </span>
                      <span className={styles.sep}>·</span>
                      <span className={styles.stats}>
                        {previewContent.length}c ·{" "}
                        {previewContent.split(/\s+/).filter(Boolean).length}w ·{" "}
                        {previewContent.split("\n").length}l
                      </span>
                      <span className={styles.sep}>·</span>
                      <span className={styles.path} title={selectedTemplate.path}>
                        {selectedTemplate.path.replace(HOME_DIR, "~")}
                      </span>
                    </>
                  )}
                </div>
                <div className={styles.footerRight}>
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
          )}
        </div>
      </div>
    </div>
  );
}
