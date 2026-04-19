/**
 * InputArea - Chat Input Component
 *
 * 职责：
 * - 负责消息输入区域的 UI 渲染
 * - 包含输入框、工具栏、命令菜单、文件选择器、图片预览
 * - 不包含业务逻辑，通过 useInputArea hook 处理
 */

// ===== [ANCHOR:IMPORTS] =====

import { useCallback, useEffect, useRef } from "react";
import { useInputArea } from "@/features/chat/hooks/useInputArea";
import { useModalStore } from "@/features/chat/stores/modalStore";
import styles from "./InputArea.module.css";

// ===== [ANCHOR:TYPES] =====

interface InputAreaProps {
  value: string;
  isStreaming: boolean;
  isRunning?: boolean; // Pi coding agent turn运行状态
  onChange: (text: string) => void;
  onSend: () => void;
  onAbort: () => void;
  onSteer?: (text: string) => void; // steer模式发送
  onBashCommand?: (command: string) => void;
  onSlashCommand?: (command: string, args: string) => void;
  onSendWithImages?: (
    text: string,
    images: Array<{
      type: "image";
      source: { type: "base64"; mediaType: string; data: string };
    }>
  ) => void;
  onNewSession?: () => void;
  // 自动滚屏相关
  shouldScrollToBottom?: boolean;
  onToggleScroll?: () => void;
  // 重新加载消息
  onReloadMessages?: () => void;
  isLoadingMore?: boolean;
}

// ===== [ANCHOR:COMPONENT] =====

export function InputArea({
  value,
  isStreaming,
  isRunning = false,
  onChange,
  onSend,
  onAbort,
  onSteer,
  onBashCommand,
  onSlashCommand,
  onSendWithImages,
  onNewSession,
  // 自动滚屏相关
  shouldScrollToBottom = true,
  onToggleScroll,
  // 重新加载消息
  onReloadMessages,
  isLoadingMore = false,
}: InputAreaProps) {
  // ===== [ANCHOR:REFS] =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ===== [ANCHOR:HOOKS] =====
  const inputArea = useInputArea({
    value,
    isStreaming,
    isRunning,
    onChange,
    onSend,
    onAbort,
    onSteer,
    onBashCommand,
    onSlashCommand,
    onSendWithImages,
  });

  // ===== [ANCHOR:EFFECTS] =====
  useEffect(() => {
    if (value === "" && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value]);

  // ===== [ANCHOR:HANDLERS] =====
  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.max(textarea.scrollHeight, 64);
      textarea.style.height = `${Math.min(newHeight, 200)}px`;
    }
  }, []);

  // ===== [ANCHOR:RENDER] =====
  return (
    <div className={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.md,.json,.js,.ts,.py,.sh,.java,.cpp,.c,.h,.go,.rs,.php,.rb,.swift,.kt,.html,.css,.scss,.yaml,.yml,.xml"
        className={styles.hiddenInput}
        onChange={(e) => {
          inputArea.imageUpload.addImages(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Slash Commands Menu */}
      {inputArea.slashCommands.isOpen && (
        <div className={styles.commandMenu}>
          {inputArea.slashCommands.filteredCommands.length > 0 ? (
            inputArea.slashCommands.filteredCommands.map((cmd, index) => (
              <button
                type="button"
                key={cmd.name}
                className={`${styles.commandItem} ${
                  index === inputArea.slashCommands.selectedIndex ? styles.selected : ""
                }`}
                onClick={() => inputArea.slashCommands.selectCurrent()}
                onMouseEnter={() => inputArea.slashCommands.setSelectedIndex(index)}
              >
                <span className={styles.commandIcon}>{cmd.icon}</span>
                <span className={styles.commandName}>{cmd.name}</span>
              </button>
            ))
          ) : (
            <div className={styles.loadingItem}>No commands found</div>
          )}
        </div>
      )}

      {/* File Picker */}
      {inputArea.filePicker.isOpen && (
        <div className={styles.filePicker}>
          <div className={styles.filePickerHeader}>
            <FileIcon />
            <span>Select file or directory</span>
          </div>
          {inputArea.filePicker.isLoading ? (
            <div className={styles.loadingItem}>Loading files...</div>
          ) : inputArea.filePicker.filteredFiles.length > 0 ? (
            inputArea.filePicker.filteredFiles.map((file, index) => (
              <button
                type="button"
                key={file.path}
                className={`${styles.fileItem} ${
                  index === inputArea.filePicker.selectedIndex ? styles.selected : ""
                }`}
                onClick={() => inputArea.filePicker.selectCurrent()}
                onMouseEnter={() => inputArea.filePicker.setSelectedIndex(index)}
              >
                <span className={styles.fileIcon}>
                  {file.isDirectory ? <FolderIcon /> : <DocIcon />}
                </span>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.filePath}>{file.path}</span>
              </button>
            ))
          ) : (
            <div className={styles.loadingItem}>No files found</div>
          )}
        </div>
      )}

      {/* Image Preview Bar */}
      {inputArea.imageUpload.images.length > 0 && inputArea.imageUpload.showPreview && (
        <div className={styles.imagePreviewBar}>
          {inputArea.imageUpload.images.map((img) => (
            <div key={img.id} className={styles.imagePreviewItem}>
              <img src={img.preview} alt="Upload" />
              {img.isProcessingOCR && <div className={styles.ocrIndicator}>⋯</div>}
              {img.ocrText && <div className={styles.ocrBadge}>T</div>}
              <button
                type="button"
                className={styles.removeImageBtn}
                onClick={() => inputArea.imageUpload.removeImage(img.id)}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.togglePreviewBtn}
            onClick={() => inputArea.imageUpload.togglePreview()}
          >
            Hide
          </button>
        </div>
      )}
      {inputArea.imageUpload.images.length > 0 && !inputArea.imageUpload.showPreview && (
        <div className={styles.imageCountBar}>
          <span>{inputArea.imageUpload.images.length} image(s)</span>
          <button type="button" onClick={() => inputArea.imageUpload.togglePreview()}>
            Show
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={`${styles.textarea} ${inputArea.isBashMode ? styles.bashMode : ""}`}
          placeholder={inputArea.placeholder}
          value={value}
          onChange={(e) => {
            inputArea.handleChange(e);
            setTimeout(autoResizeTextarea, 0);
          }}
          onKeyDown={(e) => {
            inputArea.handleKeyDown(e);
            setTimeout(autoResizeTextarea, 0);
          }}
          rows={2}
          disabled={false} /* isRunning时也可以输入 */
        />
        <div className={styles.buttonColumn}>
          {/* Send按钮 - isRunning时绿色(steer)，否则蓝色(prompt) */}
          <button
            type="button"
            className={`${styles.sendButton} ${isRunning ? styles.steerButton : styles.promptButton}`}
            onClick={inputArea.handleSend}
            title={isRunning ? "Steer (Ctrl+Enter)" : "Send (Ctrl+Enter)"}
          >
            <SendIcon />
          </button>
          {/* Abort按钮 - isRunning时激活(红色)，否则disabled(灰色) */}
          <button
            type="button"
            className={`${styles.abortButton} ${isRunning ? styles.active : styles.disabled}`}
            onClick={onAbort}
            title="Abort Generation"
            disabled={!isRunning}
          >
            <AbortIcon />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <SystemPromptButton isStreaming={isStreaming} />
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => inputArea.filePicker.open()}
          title="Mention file (@)"
          disabled={isStreaming}
        >
          <span className={styles.btnIcon}>@</span>
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => inputArea.slashCommands.open()}
          title="Slash command (/)"
          disabled={isStreaming}
        >
          <span className={styles.btnIcon}>/</span>
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => inputArea.insertTextAtCursor("!", "bash")}
          title="Bash command (!)"
          disabled={isStreaming}
        >
          <span className={styles.btnIcon}>!</span>
        </button>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => fileInputRef.current?.click()}
          title="Upload image/file"
          disabled={isStreaming}
        >
          <ImageIcon />
        </button>

        {/* 重新加载所有消息按钮 */}
        {onReloadMessages && (
          <button
            type="button"
            className={`${styles.toolbarBtn} ${isLoadingMore ? styles.loading : ""}`}
            onClick={onReloadMessages}
            title="重新加载所有历史消息"
            disabled={isLoadingMore}
          >
            <ReloadIcon isLoading={isLoadingMore} />
          </button>
        )}

        {/* 自动滚屏按钮 */}
        {onToggleScroll && (
          <button
            type="button"
            className={`${styles.toolbarBtn} ${shouldScrollToBottom ? styles.active : ""}`}
            onClick={onToggleScroll}
            title={shouldScrollToBottom ? "自动滚屏已启用 (点击关闭)" : "自动滚屏已关闭 (点击启用)"}
            // 滚屏按钮在AI处理时仍然可用，用户应该能控制滚屏状态
          >
            <ScrollIcon active={shouldScrollToBottom} />
          </button>
        )}

        {/* New Session按钮 - 放到底部最右侧，与其他toolbar按钮同宽 */}
        {onNewSession && (
          <button
            type="button"
            className={`${styles.toolbarBtn} ${styles.newSessionBtn}`}
            onClick={onNewSession}
            title="New Session"
            disabled={isStreaming}
          >
            <PlusIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ===== [ANCHOR:ICONS] =====

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function AbortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ScrollIcon({ active = true }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
      {active ? (
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      ) : (
        <circle cx="12" cy="12" r="2" stroke="currentColor" fill="none" />
      )}
    </svg>
  );
}

function ReloadIcon({ isLoading = false }: { isLoading?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={isLoading ? styles.spinning : ""}
    >
      <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

// ===== [ANCHOR:SUB_COMPONENTS] =====

function SystemPromptButton({ isStreaming }: { isStreaming: boolean }) {
  const openSystemPrompt = useModalStore((state) => state.openSystemPrompt);

  return (
    <button
      type="button"
      className={styles.toolbarBtn}
      onClick={() => openSystemPrompt()}
      title="System Prompt"
      disabled={isStreaming}
    >
      <DocumentIcon />
    </button>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
