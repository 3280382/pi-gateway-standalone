/**
 * LogMonitorConfigModal - 日志监控配置弹窗
 *
 * 支持：
 * - 新建监控配置
 * - 编辑现有监控配置
 */

import { useEffect, useState } from "react";
import { useLogMonitorStore } from "@/features/files/stores/logMonitorStore";
import styles from "./Modals.module.css";

interface LogMonitorConfigModalProps {
  isOpen: boolean;
  editingId?: string | null;
  onClose: () => void;
}

export function LogMonitorConfigModal({ isOpen, editingId, onClose }: LogMonitorConfigModalProps) {
  const [name, setName] = useState("");
  const [pathsText, setPathsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addConfig = useLogMonitorStore((s) => s.addConfig);
  const updateConfig = useLogMonitorStore((s) => s.updateConfig);
  const getConfigById = useLogMonitorStore((s) => s.getConfigById);
  const configs = useLogMonitorStore((s) => s.configs);

  const isEditing = !!editingId;
  const existing = editingId ? getConfigById(editingId) : undefined;

  // 加载编辑数据
  useEffect(() => {
    if (isOpen && existing) {
      setName(existing.name);
      setPathsText(existing.filePaths.join("\n"));
    } else if (!isOpen) {
      setName("");
      setPathsText("");
      setIsSubmitting(false);
    }
  }, [isOpen, existing]);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const paths = pathsText
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paths.length === 0) return;

    setIsSubmitting(true);

    try {
      if (isEditing && editingId) {
        updateConfig(editingId, { name: trimmedName, filePaths: paths });
      } else {
        addConfig(trimmedName, paths);
      }
      setName("");
      setPathsText("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName("");
    setPathsText("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isNameDuplicated =
    !isEditing && configs.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

  const canSubmit =
    name.trim().length > 0 && pathsText.trim().length > 0 && !isNameDuplicated && !isSubmitting;

  if (!isOpen) return null;

  const nameInputId = "log-monitor-name";
  const pathsInputId = "log-monitor-paths";

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      onClick={handleCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleCancel();
      }}
    >
      <div
        className={styles.logMonitorModal}
        role="document"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={styles.logMonitorHeader}>
          <span className={styles.logMonitorTitle}>
            {isEditing ? "✏️ Edit Monitor" : "📋 New Log Monitor"}
          </span>
          <button type="button" className={styles.close} onClick={handleCancel}>
            ✕
          </button>
        </div>

        <div className={styles.logMonitorContent}>
          {/* 名称输入 */}
          <div className={styles.logMonitorField}>
            <label htmlFor={nameInputId} className={styles.logMonitorLabel}>
              Monitor Name
            </label>
            <input
              id={nameInputId}
              type="text"
              className={styles.logMonitorInput}
              placeholder="e.g. Server Logs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {isNameDuplicated && (
              <span className={styles.logMonitorError}>Name already exists</span>
            )}
          </div>

          {/* 文件路径输入 */}
          <div className={styles.logMonitorField}>
            <label htmlFor={pathsInputId} className={styles.logMonitorLabel}>
              File Paths <span className={styles.logMonitorHint}>(one per line)</span>
            </label>
            <textarea
              id={pathsInputId}
              className={`${styles.logMonitorInput} ${styles.logMonitorTextarea}`}
              placeholder={`/var/log/nginx/access.log\n/var/log/nginx/error.log\n/var/log/app.log`}
              value={pathsText}
              onChange={(e) => setPathsText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
            />
          </div>

          <div className={styles.logMonitorHintRow}>
            Press {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to save
          </div>
        </div>

        <div className={styles.logMonitorFooter}>
          <button
            type="button"
            className={styles.logMonitorCancelBtn}
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.logMonitorSubmitBtn}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
