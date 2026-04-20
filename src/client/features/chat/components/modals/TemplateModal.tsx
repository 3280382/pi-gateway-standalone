/**
 * TemplateModal - Full-screen Prompt Template Browser
 *
 * Features:
 * - Full-screen modal with split-pane layout
 * - Left: Template list with folder navigation
 * - Right: Preview pane with syntax highlighting
 * - Select and preview before inserting
 * - WebSocket-based communication
 */

import { useEffect, useState, useCallback } from "react";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { websocketService } from "@/services/websocket.service";
import styles from "./TemplateModal.module.css";

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
  
  // Template list state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "global" | "local">("all");

  // Listen for WebSocket messages
  useEffect(() => {
    if (!isTemplateModalOpen) return;

    if (!websocketService.isConnected) {
      setError("WebSocket not connected");
      setLoading(false);
      return;
    }

    // Subscribe to template events
    const unsubscribeList = websocketService.on("templates_list", (data: any) => {
      const loadedTemplates = data.templates || [];
      setTemplates(loadedTemplates);
      setLoading(false);
      
      // Auto-select first template if none selected
      if (loadedTemplates.length > 0 && !selectedTemplate) {
        setSelectedTemplate(loadedTemplates[0]);
        loadTemplateContent(loadedTemplates[0].name);
      }
    });

    const unsubscribeContent = websocketService.on("template_content", (data: any) => {
      setPreviewContent(data.content || "");
      setPreviewLoading(false);
    });

    const unsubscribeError = websocketService.on("error", (data: any) => {
      if (data.messageType?.includes("template")) {
        setError(data.error || "Failed to load template");
        setLoading(false);
        setPreviewLoading(false);
      }
    });

    return () => {
      unsubscribeList();
      unsubscribeContent();
      unsubscribeError();
    };
  }, [isTemplateModalOpen, selectedTemplate]);

  // Request templates list when modal opens
  useEffect(() => {
    if (!isTemplateModalOpen) return;

    if (!websocketService.isConnected) {
      setError("WebSocket not connected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setTemplates([]);
    setSelectedTemplate(null);
    setPreviewContent("");

    websocketService.send("list_templates");
  }, [isTemplateModalOpen]);

  const loadTemplateContent = useCallback((templateName: string) => {
    if (!websocketService.isConnected) return;
    
    setPreviewLoading(true);
    websocketService.send("get_template", { name: templateName });
  }, []);

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    loadTemplateContent(template.name);
  }, [loadTemplateContent]);

  const handleInsert = useCallback(() => {
    if (onTemplateSelect && previewContent) {
      onTemplateSelect(previewContent);
    }
    closeTemplateModal();
  }, [onTemplateSelect, previewContent, closeTemplateModal]);

  const handleDoubleClick = useCallback((template: Template) => {
    handleSelectTemplate(template);
    // Small delay to allow preview to load
    setTimeout(() => {
      if (onTemplateSelect) {
        onTemplateSelect(previewContent);
        closeTemplateModal();
      }
    }, 100);
  }, [handleSelectTemplate, onTemplateSelect, previewContent, closeTemplateModal]);

  if (!isTemplateModalOpen) return null;

  // Filter templates by tab
  const filteredTemplates = templates.filter((t) => {
    if (activeTab === "all") return true;
    return t.source === activeTab;
  });

  // Group by source for display
  const globalTemplates = filteredTemplates.filter((t) => t.source === "global");
  const localTemplates = filteredTemplates.filter((t) => t.source === "local");

  return (
    <div className={styles.overlay} onClick={closeTemplateModal}>
      <div className={styles.fullscreenModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3>📄 Prompt Templates</h3>
            <span className={styles.templateCount}>
              {templates.length} templates available
            </span>
          </div>
          
          <div className={styles.headerCenter}>
            <div className={styles.tabButtons}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "all" ? styles.active : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "global" ? styles.active : ""}`}
                onClick={() => setActiveTab("global")}
              >
                Global
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "local" ? styles.active : ""}`}
                onClick={() => setActiveTab("local")}
              >
                Local
              </button>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.insertBtn}
              disabled={!selectedTemplate || previewLoading}
              onClick={handleInsert}
            >
              Insert Template
            </button>
            <button type="button" className={styles.closeBtn} onClick={closeTemplateModal}>
              ✕
            </button>
          </div>
        </div>

        {/* Main Content - Split Pane */}
        <div className={styles.mainContent}>
          {/* Left Sidebar - Template List */}
          <div className={styles.sidebar}>
            {loading && templates.length === 0 ? (
              <div className={styles.loading}>Loading templates...</div>
            ) : error ? (
              <div className={styles.error}>{error}</div>
            ) : templates.length === 0 ? (
              <div className={styles.empty}>
                <p>No templates found.</p>
                <p className={styles.hint}>
                  Create .md files in:
                  <br />
                  <code>{HOME_DIR}/.pi/agent/prompts/</code>
                  <br />
                  <code>{workingDir}/.pi/prompts/</code>
                </p>
              </div>
            ) : (
              <div className={styles.templateTree}>
                {/* Local templates section */}
                {(activeTab === "all" || activeTab === "local") && localTemplates.length > 0 && (
                  <div className={styles.treeSection}>
                    <div className={styles.treeSectionHeader}>
                      <FolderIcon />
                      <span>Local ({localTemplates.length})</span>
                      <span className={styles.pathHint}>./.pi/prompts/</span>
                    </div>
                    {localTemplates.map((template) => (
                      <div
                        key={template.path}
                        className={`${styles.treeItem} ${
                          selectedTemplate?.path === template.path ? styles.selected : ""
                        }`}
                        onClick={() => handleSelectTemplate(template)}
                        onDoubleClick={() => handleDoubleClick(template)}
                      >
                        <FileIcon />
                        <span className={styles.fileName}>{template.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Global templates section */}
                {(activeTab === "all" || activeTab === "global") && globalTemplates.length > 0 && (
                  <div className={styles.treeSection}>
                    <div className={styles.treeSectionHeader}>
                      <FolderIcon />
                      <span>Global ({globalTemplates.length})</span>
                      <span className={styles.pathHint}>~/.pi/agent/prompts/</span>
                    </div>
                    {globalTemplates.map((template) => (
                      <div
                        key={template.path}
                        className={`${styles.treeItem} ${
                          selectedTemplate?.path === template.path ? styles.selected : ""
                        }`}
                        onClick={() => handleSelectTemplate(template)}
                        onDoubleClick={() => handleDoubleClick(template)}
                      >
                        <FileIcon />
                        <span className={styles.fileName}>{template.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Content - Preview */}
          <div className={styles.previewPane}>
            {selectedTemplate ? (
              <>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitle}>
                    <FileIcon />
                    <span>{selectedTemplate.name}</span>
                    <span className={`${styles.sourceBadge} ${styles[selectedTemplate.source]}`}>
                      {selectedTemplate.source}
                    </span>
                  </div>
                  <div className={styles.previewActions}>
                    <span className={styles.filePath}>{selectedTemplate.path}</span>
                  </div>
                </div>
                
                <div className={styles.previewContent}>
                  {previewLoading ? (
                    <div className={styles.previewLoading}>
                      <div className={styles.spinner} />
                      <span>Loading preview...</span>
                    </div>
                  ) : (
                    <pre className={styles.codeBlock}>
                      <code>{previewContent}</code>
                    </pre>
                  )}
                </div>

                <div className={styles.previewFooter}>
                  <div className={styles.previewStats}>
                    {previewContent && (
                      <>
                        <span>{previewContent.length} chars</span>
                        <span>{previewContent.split(/\s+/).filter(Boolean).length} words</span>
                        <span>{previewContent.split("\n").length} lines</span>
                      </>
                    )}
                  </div>
                  <div className={styles.previewButtons}>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={closeTemplateModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.insertBtn}
                      disabled={previewLoading}
                      onClick={handleInsert}
                    >
                      Insert Template
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyPreview}>
                <div className={styles.emptyIcon}>📄</div>
                <p>Select a template to preview</p>
                <p className={styles.emptyHint}>
                  Click on a template from the list to view its content
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icons
function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}
