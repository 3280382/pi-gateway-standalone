/**
 * TemplateModal - Prompt Template Selector
 *
 * Features:
 * - List all available prompt templates from global and local directories
 * - Select template to insert into input area
 * - WebSocket-based communication
 */

import { useEffect, useState, useCallback } from "react";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { websocketService } from "@/services/websocket.service";
import styles from "./Modals.module.css";

// Home directory - in browser env we use a default
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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Listen for WebSocket messages
  useEffect(() => {
    if (!isTemplateModalOpen) return;

    // Check WebSocket connection status
    const checkConnection = () => {
      const isConnected = websocketService.isConnected;
      setWsConnected(isConnected);
      return isConnected;
    };

    if (!checkConnection()) {
      setError("WebSocket not connected");
      setLoading(false);
      return;
    }

    // Subscribe to messages
    const unsubscribe = websocketService.on("message", (data: any) => {
      try {
        if (data.type === "templates_list") {
          setTemplates(data.templates || []);
          setLoading(false);
        } else if (data.type === "template_content") {
          // Template content received, insert it
          if (onTemplateSelect && data.content) {
            onTemplateSelect(data.content);
          }
          closeTemplateModal();
          setLoading(false);
        } else if (data.type === "error" && data.messageType?.includes("template")) {
          setError(data.error || "Failed to load template");
          setLoading(false);
        }
      } catch (err) {
        console.error("[TemplateModal] Failed to parse message:", err);
      }
    });

    return () => unsubscribe();
  }, [isTemplateModalOpen, onTemplateSelect, closeTemplateModal]);

  // Request templates list when modal opens
  useEffect(() => {
    if (!isTemplateModalOpen) return;

    // Check connection before sending
    if (!websocketService.isConnected) {
      setError("WebSocket not connected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setTemplates([]);
    setSelectedTemplate(null);

    websocketService.send("list_templates");
  }, [isTemplateModalOpen]);

  const handleSelect = useCallback(
    (templateName: string) => {
      if (!websocketService.isConnected) {
        setError("WebSocket not connected");
        return;
      }

      setSelectedTemplate(templateName);
      setLoading(true);

      websocketService.send("get_template", { name: templateName });
    },
    []
  );

  if (!isTemplateModalOpen) return null;

  // Group templates by source
  const globalTemplates = templates.filter((t) => t.source === "global");
  const localTemplates = templates.filter((t) => t.source === "local");

  return (
    <div className={styles.overlay} onClick={closeTemplateModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Insert Prompt Template</h3>
          <button type="button" className={styles.closeBtn} onClick={closeTemplateModal}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {loading && templates.length === 0 ? (
            <div className={styles.loading}>Loading templates...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : templates.length === 0 ? (
            <div className={styles.empty}>
              <p>No templates found.</p>
              <p className={styles.hint}>
                Create .md files in {HOME_DIR}/.pi/agent/prompts/ or {workingDir}/.pi/prompts/
              </p>
            </div>
          ) : (
            <div className={styles.templateList}>
              {/* Local templates */}
              {localTemplates.length > 0 && (
                <div className={styles.templateGroup}>
                  <div className={styles.templateGroupHeader}>
                    <span className={styles.sourceBadge}>Local</span>
                    <span className={styles.pathHint}>./.pi/prompts/</span>
                  </div>
                  {localTemplates.map((template) => (
                    <div
                      key={template.path}
                      className={`${styles.templateItem} ${
                        selectedTemplate === template.name ? styles.selected : ""
                      }`}
                      onClick={() => handleSelect(template.name)}
                    >
                      <span className={styles.templateName}>{template.name}</span>
                      {selectedTemplate === template.name && loading && (
                        <span className={styles.loadingIndicator}>⋯</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Global templates */}
              {globalTemplates.length > 0 && (
                <div className={styles.templateGroup}>
                  <div className={styles.templateGroupHeader}>
                    <span className={styles.sourceBadge}>Global</span>
                    <span className={styles.pathHint}>~/.pi/agent/prompts/</span>
                  </div>
                  {globalTemplates.map((template) => (
                    <div
                      key={template.path}
                      className={`${styles.templateItem} ${
                        selectedTemplate === template.name ? styles.selected : ""
                      }`}
                      onClick={() => handleSelect(template.name)}
                    >
                      <span className={styles.templateName}>{template.name}</span>
                      {selectedTemplate === template.name && loading && (
                        <span className={styles.loadingIndicator}>⋯</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={closeTemplateModal}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
