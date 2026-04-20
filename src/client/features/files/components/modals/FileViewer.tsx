/**
 * FileViewer - files查看器Modal
 *
 * Responsibilities:纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useFileViewer hook 获取所有逻辑
 */

import { useCallback, useEffect, useRef } from "react";
import { useFileViewer } from "@/features/files/hooks";
import { useFileViewerStore } from "@/features/files/stores/viewerStore";
import { fileViewerDebug } from "@/lib/debug";
import styles from "./FileViewer.module.css";


export function FileViewer() {
  // ========== 1. State ==========
  // 从 store Get state
  const {
    isOpen,
    filePath,
    fileName,
    mode,
    content,
    isLoading,
    error,
    editedContent,
    isSaving,
    showInvisibleChars,
    terminalOutput,
    isExecuting,
    closeViewer,
    setMode,
    setEditedContent,
    toggleShowInvisibleChars,
    clearTerminal,
  } = useFileViewerStore();

  // 从 hook 获取业务逻辑
  const { fileTypes, saveFile, copyPath, getLanguage, stopExecution } = useFileViewer();

  // ========== 2. Ref ==========
  const terminalRef = useRef<HTMLDivElement>(null);
  // CodeMirror 编辑器相关 refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ========== 3. Effects ==========
  // 自动滚动终端
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  // Syntax highlighting - only in view mode using Prism.js with autoloader
  useEffect(() => {
    if (mode === "view" && content && !fileTypes.isImage && !fileTypes.isHtml) {
      const highlight = () => {
        if ((window as any).Prism) {
          const Prism = (window as any).Prism;
          const codeElement = document.querySelector("[data-prism-code]");
          if (codeElement) {
            Prism.highlightElement(codeElement);
          }
        }
      };

      // Wait a bit for autoloader to fetch language if needed
      const timer = setTimeout(highlight, 50);
      return () => clearTimeout(timer);
    }
  }, [content, mode, fileTypes.isImage, fileTypes.isHtml]);

  // 进入编辑模式后自动聚焦 textarea
  useEffect(() => {
    if (mode === "edit" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  // 处理 textarea 变化
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  };

  // 处理 Ctrl+S 保存
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      saveFile();
    }
  };

  // ========== 5. Computed ==========
  // Prism.js 查看模式语言映射
  const language = getLanguage();
  const prismLanguage =
    language === "tsx" ? "tsx" :
    language === "jsx" ? "jsx" :
    language === "md" || language === "markdown" ? "markdown" :
    language;

  // 渲染带有非可视化符号的内容
  const renderContentWithInvisibleChars = (text: string): string => {
    if (!showInvisibleChars) return text;

    // 替换非可视化chars
    return text
      .replace(/\t/g, "→   ") // 制表符
      .replace(/ /g, "·") // 空格
      .replace(/\n/g, "¶\n") // 换Rows符（在Rows尾添加）
      .replace(/\r/g, "↵"); // 回车符
  };

  // ========== 6. Render ==========
  if (!isOpen) {
    fileViewerDebug.debug("FileViewer未渲染 - isOpen=false");
    return null;
  }

  fileViewerDebug.info("FileViewer渲染", {
    filePath,
    fileName,
    mode,
    isLoading,
    hasError: !!error,
    contentLength: content?.length,
  });

  return (
    <div className={styles.modal}>
      <div className={styles.content}>
        {/* 头部 */}
        <div className={styles.header}>
          <div className={styles.title}>
            <span>{fileName}</span>
            <span className={styles.type}>{mode.toUpperCase()}</span>
  
            <button
              type="button"
              className={styles.btnCopyPath}
              onClick={copyPath}
              title="Copy absolute path"
            >
              <CopyIcon />
            </button>
          </div>
          <div className={styles.actions}>
            {mode === "view" && (
              <button
                type="button"
                className={`${styles.btnToggle} ${showInvisibleChars ? styles.active : ""}`}
                onClick={toggleShowInvisibleChars}
                title="Show invisible characters (spaces, tabs, line breaks)"
              >
                {showInvisibleChars ? "Hide" : "Show"} Invisible
              </button>
            )}
            {mode === "view" && fileTypes.isExecutable && (
              <button
                type="button"
                className={styles.btnExecute}
                onClick={() => setMode("execute")}
              >
                ▶ Execute
              </button>
            )}
            {mode === "view" && fileTypes.isEditable && (
              <button type="button" className={styles.btnEdit} onClick={() => setMode("edit")}>
                ✎ Edit
              </button>
            )}
            <button type="button" className={styles.btnClose} onClick={closeViewer}>
              ✕
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : mode === "edit" ? (
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={editedContent || ""}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
          ) : mode === "execute" ? (
            <div className={styles.terminal} ref={terminalRef}>
              <pre>{terminalOutput}</pre>
              {isExecuting && <span className={styles.cursor}>▊</span>}
            </div>
          ) : fileTypes.isImage ? (
            <img src={fileTypes.getRawFileUrl(filePath)} alt={fileName} className={styles.image} />
          ) : fileTypes.isHtml ? (
            <iframe
              src={fileTypes.getRawFileUrl(filePath)}
              title={fileName}
              className={styles.iframe}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          ) : (
            <pre className={`${styles.code} language-${prismLanguage}`}>
              <code data-prism-code className={`language-${prismLanguage}`}>
                {showInvisibleChars
                  ? renderContentWithInvisibleChars(
                      typeof content === "string" ? content : JSON.stringify(content, null, 2)
                    )
                  : typeof content === "string"
                    ? content
                    : JSON.stringify(content, null, 2)}
              </code>
            </pre>
          )}
        </div>

        {/* 底部操作 */}
        {mode === "edit" && (
          <div className={styles.footer}>
            <button type="button" className={styles.btnSecondary} onClick={() => setMode("view")}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={saveFile}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save (Ctrl+S)"}
            </button>
          </div>
        )}

        {mode === "execute" && (
          <div className={styles.footer}>
            <button type="button" className={styles.btnSecondary} onClick={clearTerminal}>
              Clear
            </button>
            <button
              type="button"
              className={styles.btnDanger}
              onClick={stopExecution}
              disabled={!isExecuting}
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Icon Group件
function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
