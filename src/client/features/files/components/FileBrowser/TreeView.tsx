/**
 * TreeView - 树形目录浏览组件
 * 作为文件浏览器的一个视图模式（类似grid和list）
 */

import type React from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { useFileItemActions } from "@/features/files/hooks";
import type { TreeNode } from "@/features/files/types";
import styles from "./TreeView.module.css";

interface TreeViewProps {
  items: TreeNode[];
  filterMode?: "normal" | "all" | "search";
  searchText?: string;
}

const DEFAULT_EXCLUDES = [
  "node_modules",
  "__pycache__",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  ".coverage",
  ".idea",
  ".vscode",
];

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

/** 过滤树节点 */
function filterNodes(
  items: TreeNode[],
  mode: "normal" | "all" | "search",
  search: string
): TreeNode[] {
  if (mode === "all" && !search) return items;

  return items.filter((item) => {
    // 搜索模式
    if (search) {
      return item.name.toLowerCase().includes(search.toLowerCase());
    }

    // 正常模式 - 排除隐藏文件
    if (mode === "normal") {
      if (item.name.startsWith(".") || DEFAULT_EXCLUDES.includes(item.name)) {
        return false;
      }
    }

    return true;
  });
}

export const TreeView = memo<TreeViewProps>(
  ({ items, filterMode = "normal", searchText = "" }) => {
    // ========== 1. State ==========
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // ========== 2. Hooks ==========
    const {
      selectedItems,
      isMultiSelectMode,
      getItemHandlers,
    } = useFileItemActions();

    // ========== 3. Computed ==========
    const filteredItems = useMemo(() => {
      return filterNodes(items, filterMode, searchText);
    }, [items, filterMode, searchText]);

    // ========== 4. Actions ==========
    const toggleNode = useCallback((path: string) => {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    }, []);

    // ========== 5. Render ==========
    return (
      <div className={styles.treeView}>
        {filteredItems.length === 0 ? (
          <div className={styles.empty}>No files found</div>
        ) : (
          <div className={styles.tree}>
            {filteredItems.map((node) => {
              const icon = getFileIcon(node.name, node.isDirectory);
              const level = node.level || 0;
              const isLast = node.isLast || false;
              const isSelected = selectedItems.includes(node.path);
              const handlers = getItemHandlers({
                ...node,
                size: 0,
                modified: "",
              } as any);

              // 搜索高亮
              let displayName: React.ReactNode = node.name;
              if (searchText) {
                const escaped = escapeRegExp(searchText);
                const parts = node.name.split(new RegExp(`(${escaped})`, "gi"));
                displayName = parts.map((p, i) =>
                  p.toLowerCase() === searchText.toLowerCase() ? (
                    <mark key={i} className={styles.highlight}>
                      {p}
                    </mark>
                  ) : (
                    p
                  )
                );
              }

              return (
                <div
                  key={node.path}
                  className={`${styles.node} ${isSelected ? styles.selected : ""} ${
                    node.isDirectory ? styles.directory : ""
                  }`}
                  style={{ paddingLeft: `${level * 24 + 16}px` }}
                  onClick={() => {
                    if (node.isDirectory) {
                      toggleNode(node.path);
                      handlers.onTap();
                    } else {
                      handlers.onTap();
                    }
                  }}
                  onDoubleClick={handlers.onDoubleTap}
                >
                  {/* 展开/折叠指示器 */}
                  {node.isDirectory && (
                    <span className={styles.expandIcon}>
                      {expandedNodes.has(node.path) ? "▼" : "▶"}
                    </span>
                  )}

                  {/* 连接线 */}
                  <span className={styles.connector}>
                    {isLast ? "└── " : "├── "}
                  </span>

                  {/* 文件图标 */}
                  <span className={styles.icon}>{icon}</span>

                  {/* 文件名 */}
                  <span
                    className={
                      node.isDirectory ? styles.dirName : styles.fileName
                    }
                  >
                    {displayName}
                  </span>
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
