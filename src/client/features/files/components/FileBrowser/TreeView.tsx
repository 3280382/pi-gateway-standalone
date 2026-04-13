/**
 * TreeView - 树形目录浏览组件
 * 作为文件浏览器的一个视图模式（类似grid和list）
 * 显示紧凑的全量静态树，支持过滤
 */

import type React from "react";
import { memo, useCallback, useMemo } from "react";
import { useFileItemActions } from "@/features/files/hooks";
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

export const TreeView = memo<TreeViewProps>(
  ({ items }) => {
    // ========== 1. Hooks ==========
    const { selectedItems, getItemHandlers } = useFileItemActions();
    const { 
      isGitModeActive, 
      isTodoModeActive, 
      setTodoInputFile,
      treeFilterText 
    } = useFileStore();

    // ========== 2. Actions ==========
    const handleFileClick = useCallback(
      (node: TreeNode) => {
        if (!node.isDirectory) {
          const handlers = getItemHandlers({
            name: node.name,
            path: node.path,
            isDirectory: node.isDirectory,
            size: 0,
            modified: "",
            extension: node.path.split(".").pop(),
            gitStatus: node.gitStatus,
          });
          handlers.onTap();
        }
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

              // Git状态
              const gitStatusIcon = node.gitStatus
                ? {
                    untracked: { symbol: "U", color: "#f97316" },
                    modified: { symbol: "M", color: "#eab308" },
                    added: { symbol: "A", color: "#22c55e" },
                    deleted: { symbol: "D", color: "#ef4444" },
                    renamed: { symbol: "R", color: "#8b5cf6" },
                    copied: { symbol: "C", color: "#0ea5e9" },
                    conflict: { symbol: "!", color: "#dc2626" },
                    other: { symbol: "?", color: "#ec4899" },
                  }[node.gitStatus]
                : null;

              return (
                <div
                  key={node.path}
                  className={`${styles.node} ${isSelected ? styles.selected : ""}`}
                  style={{ paddingLeft: `${level * 16}px` }}
                  onClick={() => handleFileClick(node)}
                >
                  {/* 连接线 */}
                  <span className={styles.connector}>
                    {isLast ? "└── " : "├── "}
                  </span>

                  {/* 文件图标 */}
                  <span className={styles.icon}>{icon}</span>

                  {/* 文件名 */}
                  <span className={node.isDirectory ? styles.dirName : styles.fileName}>
                    {displayName}
                  </span>

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

                  {/* Todo按钮 */}
                  {isTodoModeActive && !node.isDirectory && (
                    <button
                      type="button"
                      className={styles.todoBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTodoInputFile({ path: node.path, name: node.name });
                      }}
                      title="Add todo"
                    >
                      📝
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

TreeView.displayName = "TreeView";
