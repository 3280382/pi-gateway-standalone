/**
 * TemplateModal - Clean template selector with custom dropdown
 */

import { useEffect, useState, useCallback, useRef } from "react";
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setDropdownOpen(false);
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
    setDropdownOpen(false);
  }, [loadTemplate]);

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
          <div className={styles.headerLeft} ref={dropdownRef}>
            <span className={styles.label}>Template</span>
            
            {/* Custom Dropdown */}
            <div className={styles.dropdown}>
              <button 
                className={styles.dropdownTrigger}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={loading || templates.length === 0}
              >
                <span className={styles.selectedName}>
                  {selectedTemplate?.name || "Select..."}
                </span>
                <span className={`${styles.arrow} ${dropdownOpen ? styles.open : ""}`}>▼</span>
              </button>
              
              {dropdownOpen && templates.length > 0 && (
                <div className={styles.dropdownMenu}>
                  {templates.map((t) => (
                    <div
                      key={t.path}
                      className={`${styles.dropdownItem} ${
                        selectedTemplate?.path === t.path ? styles.active : ""
                      }`}
                      onClick={() => handleSelect(t)}
                    >
                      <span className={styles.itemName}>{t.name}</span>
                      <span className={`${styles.itemBadge} ${styles[t.source]}`}>
                        {t.source[0]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedTemplate && (
              <span className={`${styles.sourceTag} ${styles[selectedTemplate.source]}`}>
                {selectedTemplate.source}
              </span>
            )}
          </div>

          <button className={styles.closeBtn} onClick={closeTemplateModal}>✕</button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.center}>Loading...</div>
          ) : error ? (
            <div className={styles.center} style={{ color: "#f85149" }}>{error}</div>
          ) : templates.length === 0 ? (
            <div className={styles.center}>
              <p>No templates</p>
              <span className={styles.hint}>Create .md in ~/.pi/agent/prompts/</span>
            </div>
          ) : (
            <>
              <div className={styles.preview}>
                {previewLoading ? (
                  <div className={styles.spinner} />
                ) : (
                  <pre className={styles.code}><code>{previewContent}</code></pre>
                )}
              </div>

              <div className={styles.footer}>
                <div className={styles.info}>
                  {selectedTemplate && (
                    <>
                      <span className={styles.name}>{selectedTemplate.name}</span>
                      <span className={styles.dot}>·</span>
                      <span className={styles.stats}>
                        {previewContent.length}c {previewContent.split(/\s+/).filter(Boolean).length}w {previewContent.split("\n").length}l
                      </span>
                    </>
                  )}
                </div>
                <div className={styles.actions}>
                  <button className={styles.btnSecondary} onClick={closeTemplateModal}>Cancel</button>
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
