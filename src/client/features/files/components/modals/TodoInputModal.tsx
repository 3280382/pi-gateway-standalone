/**
 * TodoInputModal - Todo 文本输入弹窗
 *
 * 支持：
 * - 新建 todo
 * - 编辑现有 todo（如果 editingTodo 存在）
 */

import { useEffect, useState } from "react";
import * as todoApi from "@/features/files/services/api/todoApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import styles from "./Modals.module.css";

interface TodoInputModalProps {
  isOpen: boolean;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function TodoInputModal({ isOpen, filePath, fileName, onClose }: TodoInputModalProps) {
  const [todoText, setTodoText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setTodoInputFile = useFileStore((state) => state.setTodoInputFile);
  const setEditingTodo = useFileStore((state) => state.setEditingTodo);
  const editingTodo = useFileStore((state) => state.editingTodo);
  const setTodoList = useFileStore((state) => state.setTodoList);
  const setTodoMap = useFileStore((state) => state.setTodoMap);

  // 使用全局工作directories，确保所有 todo 都写在同一  items
  const currentPath = useWorkspaceStore((state) => state.currentPath);

  const isEditing = !!editingTodo;

  // 加载编辑中的 todo 数据
  useEffect(() => {
    if (isOpen && editingTodo) {
      setTodoText(editingTodo.text);
      setTags(editingTodo.tags || []);
    } else if (!isOpen) {
      // Close时Clear
      setTodoText("");
      setTags([]);
      setTagInput("");
    }
  }, [isOpen, editingTodo]);

  const handleSubmit = async () => {
    if (!todoText.trim()) return;

    setIsSubmitting(true);

    try {
      if (isEditing && editingTodo) {
        // 更新现有 todo
        await todoApi.update({
          workingDir: currentPath,
          todoId: editingTodo.id,
          todoText: todoText.trim(),
          tags,
          assignee: editingTodo.assignee,
          dueDate: editingTodo.dueDate,
        });
      } else {
        // 新建 todo
        await todoApi.add({
          workingDir: currentPath,
          filePath,
          todoText: todoText.trim(),
          tags,
        });
      }

      // 重新加载 todo Cols表以更新角标显示
      try {
        const todos = await todoApi.list(currentPath);
        setTodoList(todos);

        // 按files路径Group
        const map = new Map<string, typeof todos>();
        for (const todo of todos) {
          const existing = map.get(todo.filePath) || [];
          existing.push(todo);
          map.set(todo.filePath, existing);
        }
        setTodoMap(map);
      } catch (err) {
        console.error("[TodoInput] Failed to refresh todos:", err);
      }

      // Clear输入并Close
      setTodoText("");
      setTags([]);
      setEditingTodo(null);
      setTodoInputFile(null);
      onClose();
    } catch (err) {
      console.error("[TodoInput] Error:", err);
      alert(isEditing ? "Failed to update todo" : "Failed to add todo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTodoText("");
    setTags([]);
    setEditingTodo(null);
    setTodoInputFile(null);
    onClose();
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.todoModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.todoHeader}>
          <span className={styles.todoTitle}>{isEditing ? "📝 Edit Todo" : "📝 Add Todo"}</span>
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
            onKeyDown={handleKeyDown}
          />

          {/* 标签输入 */}
          <div className={styles.tagSection}>
            <div className={styles.tagInputRow}>
              <input
                type="text"
                className={styles.tagInput}
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <button
                type="button"
                className={styles.tagAddBtn}
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                Add
              </button>
            </div>

            {/* 标签Cols表 */}
            {tags.length > 0 && (
              <div className={styles.tagList}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={styles.tagItem}
                    style={{
                      backgroundColor: getTagColor(tag),
                    }}
                  >
                    #{tag}
                    <button
                      type="button"
                      className={styles.tagRemoveBtn}
                      onClick={() => handleRemoveTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.todoHint}>
            Press {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to save
          </div>
        </div>

        <div className={styles.todoFooter}>
          <button
            type="button"
            className={styles.todoCancelBtn}
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.todoSubmitBtn}
            onClick={handleSubmit}
            disabled={!todoText.trim() || isSubmitting}
          >
            {isSubmitting ? "Saving..." : isEditing ? "Update Todo" : "Add Todo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 获取标签Color
function getTagColor(tag: string): string {
  const colors: Record<string, string> = {
    urgent: "#f85149",
    high: "#f85149",
    medium: "#d29922",
    low: "#58a6ff",
    bug: "#f85149",
    feature: "#238636",
    refactor: "#8b949e",
    docs: "#58a6ff",
  };
  return colors[tag.toLowerCase()] || "#6e7681";
}
