/**
 * TreeView - 树形目录浏览组件
 * 作为文件浏览器的一个视图模式（类似grid和list）
 * 显示紧凑的全量静态树，支持过滤
 */

import type React from "react";
import { memo, useCallback } from "react";
import { useFileItemActions } from "@/features/files/hooks";
import { useTreeGitStatus } from "@/features/files/hooks/useTreeGitStatus";
import * as todoApi from "@/features/files/services/api/todoApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import type { TreeNode } from "@/features/files/types";
import styles from "./TreeView.module.css";

interface TreeViewProps {
  items: TreeNode[];
}

/** 转义正则表达式特殊字符 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 获取文件图标 */
function getFileIcon(name: string, isDirectory: boolean): string {
  if (isDirectory) return "📁";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    js: "📜",
    ts: "📘",
    jsx: "⚛️",
    tsx: "⚛️",
    py: "🐍",
    java: "☕",
    go: "🔵",
    rs: "🦀",
    c: "🔧",
    cpp: "🔧",
    h: "📋",
    hpp: "📋",
    cs: "🔷",
    php: "🐘",
    rb: "💎",
    sh: "🐚",
    bash: "🐚",
    html: "🌐",
    json: "📋",
    yaml: "📋",
    yml: "📋",
    md: "📝",
    css: "🎨",
    scss: "🎨",
    png: "🖼️",
    jpg: "🖼️",
    svg: "🎨",
    txt: "📄",
    pdf: "📕",
    zip: "📦",
    "7z": "📦",
  };
  return icons[ext] || "📄";
}

export const TreeView = memo<TreeViewProps>(({ items }) => {
  // ========== 1. Hooks ==========
  const { selectedItems, getItemHandlers } = useFileItemActions();
  const {
    isGitModeActive,
    isTodoModeActive,
    setTodoInputFile,
    setEditingTodo,
    treeFilterText,
    todoMap,
    treeGitStatusMap, // TreeView 专用 Git 状态映射
  } = useFileStore();

  // 使用 TreeView 专用的 Git 状态 hook，获取整棵树的 Git 状态
  const { currentBrowsePath } = useFileStore();
  useTreeGitStatus({
    isActive: true,
    treeData: items,
    workingDir: currentBrowsePath,
  });

  // ========== 2. Actions ==========
  const handleFileClick = useCallback(
    (node: TreeNode) => {
      const fileItem = {
        name: node.name,
        path: node.path,
        isDirectory: node.isDirectory,
        size: 0,
        modified: "",
        extension: node.path.split(".").pop(),
        gitStatus: node.gitStatus,
      };
      const handlers = getItemHandlers(fileItem);
      handlers.onTap();
    },
    [getItemHandlers]
  );

  // ========== 3. Render ==========
  return (
    <div className={styles.treeView}>
      {items.length === 0 ? (
        <div className={styles.empty}>No files found</div>
      ) : (
        <div className={styles.tree}>
          {items.map((node) => {
            const icon = getFileIcon(node.name, node.isDirectory);
            const level = node.level || 0;
            const isLast = node.isLast || false;
            const isSelected = selectedItems.includes(node.path);

            // 搜索高亮
            let displayName: React.ReactNode = node.name;
            if (treeFilterText) {
              const escaped = escapeRegExp(treeFilterText);
              const parts = node.name.split(new RegExp(`(${escaped})`, "gi"));
              displayName = parts.map((p, i) =>
                p.toLowerCase() === treeFilterText.toLowerCase() ? (
                  <mark key={i} className={styles.highlight}>
                    {p}
                  </mark>
                ) : (
                  p
                )
              );
            }

            // Git状态 - 从 treeGitStatusMap 获取（整棵树的 Git 状态）
            const gitStatus = treeGitStatusMap.get(node.path);
            const gitStatusIcon = gitStatus
              ? {
                  untracked: { symbol: "U", color: "#f97316" },
                  modified: { symbol: "M", color: "#eab308" },
                  added: { symbol: "A", color: "#22c55e" },
                  deleted: { symbol: "D", color: "#ef4444" },
                  renamed: { symbol: "R", color: "#8b5cf6" },
                  copied: { symbol: "C", color: "#0ea5e9" },
                  conflict: { symbol: "!", color: "#dc2626" },
                  other: { symbol: "?", color: "#ec4899" },
                }[gitStatus]
              : null;

            // 获取该文件的todos
            const todos = todoMap.get(node.path) || [];
            const pendingTodos = todos.filter((t) => !t.checked);
            const hasTodos = todos.length > 0;
            const showTodos = isTodoModeActive && hasTodos;

            return (
              <div
                key={node.path}
                className={`${styles.node} ${isSelected ? styles.selected : ""}`}
                style={{ paddingLeft: `${level * 16}px` }}
              >
                {/* 主行 */}
                <div className={styles.nodeMain} onClick={() => handleFileClick(node)}>
                  {/* 连接线 */}
                  <span className={styles.connector}>{isLast ? "└── " : "├── "}</span>

                  {/* 文件图标 */}
                  <span className={styles.icon}>{icon}</span>

                  {/* 文件名 */}
                  <span className={node.isDirectory ? styles.dirName : styles.fileName}>
                    {displayName}
                  </span>

                  {/* 角标容器 - Git和Todo */}
                  <span className={styles.badges}>
                    {/* Git状态 */}
                    {isGitModeActive && gitStatusIcon && (
                      <span
                        className={styles.gitBadge}
                        style={{ backgroundColor: gitStatusIcon.color }}
                        title={`Git: ${node.gitStatus}`}
                      >
                        {gitStatusIcon.symbol}
                      </span>
                    )}

                    {/* Todo标识 - 鲜明绿色背景 */}
                    {isTodoModeActive && hasTodos && (
                      <span
                        className={styles.todoIndicator}
                        style={{
                          backgroundColor: pendingTodos.length > 0 ? "#22c55e" : "#16a34a",
                          color: "#ffffff",
                          fontWeight: 700,
                        }}
                        title={`${pendingTodos.length} pending, ${todos.length - pendingTodos.length} done`}
                      >
                        {pendingTodos.length > 0 ? `○${pendingTodos.length}` : `✓${todos.length}`}
                      </span>
                    )}

                    {/* 添加Todo按钮 */}
                    {isTodoModeActive && (
                      <button
                        type="button"
                        className={styles.todoAddBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTodoInputFile({ path: node.path, name: node.name });
                        }}
                        title="Add todo"
                      >
                        +
                      </button>
                    )}
                  </span>
                </div>

                {/* Todo内容显示 - 鲜明绿色 */}
                {showTodos && (
                  <div className={styles.todoList}>
                    {todos.map((todo, idx) => (
                      <div
                        key={idx}
                        className={`${styles.todoItem} ${todo.checked ? styles.todoDone : ""}`}
                        style={{
                          color: todo.checked ? "#22c55e" : "#16a34a",
                          textDecoration: todo.checked ? "line-through" : "none",
                          fontWeight: todo.checked ? "normal" : 600,
                          cursor: "pointer",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTodo(todo);
                          setTodoInputFile({ path: node.path, name: node.name });
                        }}
                        title="点击编辑"
                      >
                        <span className={styles.todoStatus}>{todo.checked ? "✓" : "○"}</span>
                        <span className={styles.todoText}>{todo.text}</span>
                        {todo.tags.length > 0 && (
                          <span className={styles.todoTags}>
                            {todo.tags.map((t) => `#${t}`).join(" ")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

TreeView.displayName = "TreeView";
