/**
 * TemplateModal - Full-featured template editor with create support
 *
 * Features:
 * - View/Edit/Create modes
 * - Save templates back to file
 * - Full-screen layout (like FileViewer)
 * - Syntax highlighting with Prism.js
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { websocketService } from "@/services/websocket.service";
import { useWorkspaceStore } from "@/stores/workspaceStore";
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

type ViewMode = "view" | "edit" | "create";

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
  const [newFileName, setNewFileName] = useState("");
  const [createSource, setCreateSource] = useState<"global" | "local">("local");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load template content (declared early to avoid TDZ in useEffect)
  const loadTemplate = useCallback((name: string) => {
    if (!websocketService.isConnected) return;
    setPreviewLoading(true);
    websocketService.send("get_template", { name });
  }, []);

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

  // Auto-focus textarea in edit/create mode
  useEffect(() => {
    if ((mode === "edit" || mode === "create") && textareaRef.current) {
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
      if (list.length > 0 && !selectedTemplate && mode !== "create") {
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
  }, [isTemplateModalOpen, selectedTemplate, mode, loadTemplate]);

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
    setNewFileName("");
    setMode("view");
    setDropdownOpen(false);
    websocketService.send("list_templates");
  }, [isTemplateModalOpen]);

  const handleSelect = useCallback(
    (template: Template) => {
      setSelectedTemplate(template);
      loadTemplate(template.name);
      setMode("view");
      setDropdownOpen(false);
    },
    [loadTemplate]
  );

  const handleInsert = useCallback(() => {
    let contentToInsert = "";
    if (mode === "edit") {
      contentToInsert = editedContent;
    } else if (mode === "create") {
      contentToInsert = editedContent;
    } else {
      contentToInsert = previewContent;
    }
    if (onTemplateSelect && contentToInsert) {
      onTemplateSelect(contentToInsert);
    }
    closeTemplateModal();
  }, [onTemplateSelect, previewContent, editedContent, mode, closeTemplateModal]);

  const handleSave = useCallback(async () => {
    if (mode === "create") {
      // Create new template
      if (!newFileName.trim()) {
        setSaveError("Filename is required");
        return;
      }

      const fileName = newFileName.trim().endsWith(".md")
        ? newFileName.trim()
        : `${newFileName.trim()}.md`;

      const targetDir =
        createSource === "global" ? `${HOME_DIR}/.pi/agent/prompts` : `${workingDir}/.pi/prompts`;

      const fullPath = `${targetDir}/${fileName}`;

      setIsSaving(true);
      setSaveError(null);

      try {
        const response = await fetch("/api/files/file/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: fullPath,
            content: editedContent || "# New Template\n\n",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create");
        }

        // Refresh template list
        setNewFileName("");
        websocketService.send("list_templates");
        setMode("view");
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Create failed");
      } finally {
        setIsSaving(false);
      }
    } else {
      // Save existing template
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
    }
  }, [mode, newFileName, createSource, workingDir, editedContent, selectedTemplate]);

  const handleNew = useCallback(() => {
    setMode("create");
    setNewFileName("");
    setEditedContent("# New Template\n\n");
    setSaveError(null);
    setSelectedTemplate(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (mode === "create") {
      setMode("view");
      setNewFileName("");
      // Select first template if available
      if (templates.length > 0) {
        setSelectedTemplate(templates[0]);
        loadTemplate(templates[0].name);
      }
    } else {
      setEditedContent(previewContent);
      setMode("view");
    }
  }, [mode, templates, previewContent, loadTemplate]);

  // Handle Ctrl+S
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      if (mode === "edit" || mode === "create") {
        handleSave();
      }
    }
  };

  if (!isTemplateModalOpen) return null;

  const hasChanges = mode === "edit" && editedContent !== previewContent;
  const canSave = mode === "create" ? newFileName.trim() && editedContent : hasChanges;

  return (
    <div className={styles.modal}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft} ref={dropdownRef}>
            <span className={styles.label}>Template</span>

            {mode === "create" ? (
              <div className={styles.createInputGroup}>
                <input
                  type="text"
                  className={styles.filenameInput}
                  placeholder="filename.md"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                />
                <select
                  className={styles.sourceSelect}
                  value={createSource}
                  onChange={(e) => setCreateSource(e.target.value as "global" | "local")}
                >
                  <option value="local">Local</option>
                  <option value="global">Global</option>
                </select>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className={styles.headerActions}>
            {mode === "view" && (
              <>
                <button className={styles.btnNew} onClick={handleNew} title="Create new template">
                  + New
                </button>
                {selectedTemplate && (
                  <button
                    className={styles.btnEdit}
                    onClick={() => setMode("edit")}
                    title="Edit template"
                  >
                    ✎ Edit
                  </button>
                )}
              </>
            )}
            {(mode === "edit" || mode === "create") && (
              <button className={styles.btnView} onClick={handleCancel} title="Cancel">
                Cancel
              </button>
            )}
            <button
              className={styles.btnInsert}
              onClick={handleInsert}
              disabled={mode === "view" ? !previewContent || previewLoading : !editedContent}
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
            <div className={styles.center} style={{ color: "#f85149" }}>
              {error}
            </div>
          ) : templates.length === 0 && mode !== "create" ? (
            <div className={styles.center}>
              <p>No templates found</p>
              <span className={styles.hint}>Click "New" to create a template</span>
            </div>
          ) : mode === "edit" || mode === "create" ? (
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              placeholder={mode === "create" ? "# Your template content here..." : ""}
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

        {/* Footer - Only show action buttons in edit/create mode */}
        {(mode === "edit" || mode === "create") && (
          <div className={styles.footer}>
            <div className={styles.footerLeft}>
              {saveError && <span className={styles.saveError}>{saveError}</span>}
            </div>
            <div className={styles.footerRight}>
              <button className={styles.btnSecondary} onClick={handleCancel}>
                Cancel
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSave}
                disabled={isSaving || !canSave}
              >
                {isSaving ? "Saving..." : mode === "create" ? "Create (Ctrl+S)" : "Save (Ctrl+S)"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
