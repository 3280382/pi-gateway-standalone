/**
 * TodoInputModal - Todo 文本输入弹窗
 */

import { useState } from "react";
import { add } from "@/features/files/services/api/todoApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import styles from "./Modals.module.css";

interface TodoInputModalProps {
  isOpen: boolean;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

// 固定的项目根目录
const PROJECT_ROOT = "/root/pi-gateway-standalone";

export function TodoInputModal({ isOpen, filePath, fileName, onClose }: TodoInputModalProps) {
  const [todoText, setTodoText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setTodoInputFile = useFileStore((state) => state.setTodoInputFile);

  const handleSubmit = async () => {
    if (!todoText.trim()) return;

    setIsSubmitting(true);
    try {
      await add({
        workingDir: PROJECT_ROOT,
        filePath,
        todoText: todoText.trim(),
      });

      // 清空输入并关闭
      setTodoText("");
      setTodoInputFile(null);
      onClose();
    } catch (err) {
      console.error("[TodoInput] Error:", err);
      alert("Failed to add todo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTodoText("");
    setTodoInputFile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.todoModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.todoHeader}>
          <span className={styles.todoTitle}>📝 Add Todo</span>
          <button type="button" className={styles.close} onClick={handleCancel}>
            ✕
          </button>
        </div>

        <div className={styles.todoContent}>
          <div className={styles.todoFileInfo}>
            <span className={styles.todoFileLabel}>File:</span>
            <code className={styles.todoFilePath}>{fileName}</code>
          </div>

          <textarea
            className={styles.todoInput}
            placeholder="Enter todo description..."
            value={todoText}
            onChange={(e) => setTodoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) {
                handleSubmit();
              }
            }}
          />

          <div className={styles.todoHint}>Press Cmd+Enter to save</div>
        </div>

        <div className={styles.todoFooter}>
          <button type="button" className={styles.todoCancelBtn} onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button"
            className={styles.todoSubmitBtn}
            onClick={handleSubmit}
            disabled={!todoText.trim() || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Add Todo"}
          </button>
        </div>
      </div>
    </div>
  );
}
