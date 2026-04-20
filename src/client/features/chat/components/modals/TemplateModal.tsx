/**
 * TemplateModal - Full-featured template editor
 *
 * Features:
 * - View/Edit modes (like FileViewer)
 * - Save templates back to file
 * - Full-screen layout (like FileViewer)
 * - Syntax highlighting with Prism.js
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

type ViewMode = "view" | "edit";

export function TemplateModal({ onTemplateSelect }: TemplateModalProps) {
  const { isTemplateModalOpen, closeTemplateModal } = useModalStore();
  const workingDir = useWorkspaceStore((state) => state.workingDir) ?? "/root";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mode, setMode] = useState<ViewMode>("view");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-resize textarea
  useEffect(() => {
    if (mode === "edit" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  // Syntax highlighting in view mode
  useEffect(() => {
    if (mode === "view" && previewContent && (window as any).Prism) {
      const Prism = (window as any).Prism;
      const codeElement = document.querySelector("[data-template-code]");
      if (codeElement) {
        setTimeout(() => Prism.highlightElement(codeElement), 50);
      }
    }
  }, [previewContent, mode]);

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
      const content = data.content || "";
      setPreviewContent(content);
      setEditedContent(content);
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
    setSaveError(null);
    setTemplates([]);
    setSelectedTemplate(null);
    setPreviewContent("");
    setEditedContent("");
    setMode("view");
    setDropdownOpen(false);
    websocketService.send("list_templates");
  }, [isTemplateModalOpen]);

  const loadTemplate = useCallback((name: string) => {
    if (!websocketService.isConnected) return;
    setPreviewLoading(true);
    setMode("view");
    websocketService.send("get_template", { name });
  }, []);

  const handleSelect = useCallback((template: Template) => {
    setSelectedTemplate(template);
    loadTemplate(template.name);
    setDropdownOpen(false);
  }, [loadTemplate]);

  const handleInsert = useCallback(() => {
    const contentToInsert = mode === "edit" ? editedContent : previewContent;
    if (onTemplateSelect && contentToInsert) {
      onTemplateSelect(contentToInsert);
    }
    closeTemplateModal();
  }, [onTemplateSelect, previewContent, editedContent, mode, closeTemplateModal]);

  const handleSave = useCallback(async () => {
    if (!selectedTemplate || !editedContent) return;
    
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/files/file/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedTemplate.path,
          content: editedContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save");
      }

      setPreviewContent(editedContent);
      setMode("view");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [selectedTemplate, editedContent]);

  // Handle Ctrl+S
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      if (mode === "edit") {
        handleSave();
      }
    }
  };

  if (!isTemplateModalOpen) return null;

  const hasChanges = mode === "edit" && editedContent !== previewContent;

  return (
    <div className={styles.modal}>
      <div className={styles.content}>
        {/* Header */}
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

            {mode === "edit" && hasChanges && (
              <span className={styles.unsavedIndicator}>●</span>
            )}
          </div>

          <div className={styles.headerActions}>
            {mode === "view" && selectedTemplate && (
              <button 
                className={styles.btnEdit}
                onClick={() => setMode("edit")}
                title="Edit template"
              >
                ✎ Edit
              </button>
            )}
            {mode === "edit" && (
              <button 
                className={styles.btnView}
                onClick={() => setMode("view")}
                title="View mode"
              >
                👁 View
              </button>
            )}
            <button 
              className={styles.btnInsert}
              onClick={handleInsert}
              disabled={!previewContent || previewLoading}
              title="Insert into chat"
            >
              Insert
            </button>
            <button className={styles.btnClose} onClick={closeTemplateModal}>
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.center}>Loading...</div>
          ) : error ? (
            <div className={styles.center} style={{ color: "#f85149" }}>{error}</div>
          ) : templates.length === 0 ? (
            <div className={styles.center}>
              <p>No templates found</p>
              <span className={styles.hint}>
                Create .md files in ~/.pi/agent/prompts/ or {workingDir}/.pi/prompts/
              </span>
            </div>
          ) : mode === "edit" ? (
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
          ) : previewLoading ? (
            <div className={styles.center}>
              <div className={styles.spinner} />
            </div>
          ) : (
            <pre className={`${styles.code} language-markdown`}>
              <code data-template-code className="language-markdown">
                {previewContent}
              </code>
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {selectedTemplate && (
              <>
                <span className={styles.fileName}>{selectedTemplate.name}</span>
                <span className={styles.sep}>·</span>
                <span className={styles.stats}>
                  {(mode === "edit" ? editedContent : previewContent).length}c {" "}
                  {(mode === "edit" ? editedContent : previewContent).split(/\s+/).filter(Boolean).length}w {" "}
                  {(mode === "edit" ? editedContent : previewContent).split("\n").length}l
                </span>
                {saveError && (
                  <span className={styles.saveError}>{saveError}</span>
                )}
              </>
            )}
          </div>
          
          <div className={styles.footerRight}>
            {mode === "edit" ? (
              <>
                <button 
                  className={styles.btnSecondary}
                  onClick={() => {
                    setEditedContent(previewContent);
                    setMode("view");
                  }}
                >
                  Cancel
                </button>
                <button 
                  className={styles.btnPrimary}
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                >
                  {isSaving ? "Saving..." : "Save (Ctrl+S)"}
                </button>
              </>
            ) : (
              <button 
                className={styles.btnSecondary}
                onClick={closeTemplateModal}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
