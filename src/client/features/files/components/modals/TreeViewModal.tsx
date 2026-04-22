/**
 * TreeViewModal - 树形directories浏览模态窗口
 * 使用 API 返回的计算字段 (level, isLast, parentLastStack)
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TreeNode } from "@/features/files/types";
import styles from "./TreeViewModal.module.css";

export interface TreeViewModalProps {
  isOpen: boolean;
  treeData: { path: string; items: TreeNode[] } | null;
  treeLoading: boolean;
  onClose: () => void;
  onFileClick: (path: string, name: string) => void;
}

type FilterMode = "normal" | "all" | "search";

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

/** 转义正则表达式特殊chars */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 获取files图标 */
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
function filterNodes(items: TreeNode[], mode: FilterMode, search: string): TreeNode[] {
  if (mode === "all" && !search) return items;

  return items.filter((item) => {
    // Search模式
    if (search) {
      return item.name.toLowerCase().includes(search.toLowerCase());
    }

    // 正常模式 - 排除Hiddenfiles
    if (mode === "normal") {
      if (item.name.startsWith(".") || DEFAULT_EXCLUDES.includes(item.name)) {
        return false;
      }
    }

    return true;
  });
}

/** 生成树形文本（用于Copy） */
function generateTreeText(items: TreeNode[]): string {
  return items
    .map((item) => {
      const indent = "  ".repeat(item.level || 0);
      const connector = item.isLast ? "└── " : "├── ";
      const icon = getFileIcon(item.name, item.isDirectory);
      return `${indent}${connector}${icon} ${item.name}`;
    })
    .join("\n");
}

export function TreeViewModal({
  isOpen,
  treeData,
  treeLoading,
  onClose,
  onFileClick,
}: TreeViewModalProps) {
  // ========== 1. State ==========
  const [filterMode, setFilterMode] = useState<FilterMode>("normal");
  const [searchText, setSearchText] = useState("");
  const [isCopySuccess, setIsCopySuccess] = useState(false);

  // ========== 2. Ref ==========
  // 暂无DOM引用需要管理

  // ========== 3. Effects ==========
  // ESC Close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ========== 4. Computed ==========
  // 过滤节点
  const filteredItems = useMemo(() => {
    if (!treeData) return [];
    return filterNodes(treeData.items, filterMode, searchText);
  }, [treeData, filterMode, searchText]);

  // 生成Copy文本
  const treeText = useMemo(() => {
    if (!treeData) return "";
    return `${treeData.path}\n${generateTreeText(filteredItems)}`;
  }, [treeData, filteredItems]);

  // ========== 5. Actions ==========
  // 处理Copy
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(treeText);
      setIsCopySuccess(true);
      setTimeout(() => setIsCopySuccess(false), 2000);
    } catch (err) {
      console.error("CopyFailed:", err);
    }
  }, [treeText]);

  // ========== 6. Render ==========
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <span className={styles.title}>{treeData?.path || "."}</span>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>
          <div className={styles.headerRow}>
            <select
              className={styles.select}
              value={filterMode}
              onChange={(e) => {
                setFilterMode(e.target.value as FilterMode);
                if (e.target.value !== "search") setSearchText("");
              }}
            >
              <option value="normal">Hidden排除files</option>
              <option value="all">显示所有</option>
              <option value="search">Search过滤...</option>
            </select>
            {filterMode === "search" && (
              <input
                className={styles.searchInput}
                placeholder="Enter filter text..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            )}
            <button
              type="button"
              className={`${styles.copyBtn} ${isCopySuccess ? styles.copied : ""}`}
              onClick={handleCopy}
              disabled={!filteredItems.length}
            >
              {isCopySuccess ? "✓ 已Copy" : "📋 Copy"}
            </button>
          </div>
        </div>

        {/* 树内容 */}
        <div className={styles.content}>
          {treeLoading ? (
            <div className={styles.message}>Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.message}>无内容</div>
          ) : (
            <div className={styles.tree}>
              {filteredItems.map((node) => {
                const icon = getFileIcon(node.name, node.isDirectory);
                const level = node.level || 0;
                const isLast = node.isLast || false;

                // SearchHeight亮
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
                    className={styles.node}
                    style={{ paddingLeft: `${level * 24 + 16}px` }}
                    onClick={() => !node.isDirectory && onFileClick(node.path, node.name)}
                  >
                    {/* 连接线 */}
                    <span className={styles.connector}>{isLast ? " " : " "}</span>

                    {/* files图标 */}
                    <span className={styles.icon}>{icon}</span>

                    {/* files名 */}
                    <span className={node.isDirectory ? styles.dirName : styles.fileName}>
                      {displayName}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 导出工具函数
export { escapeRegExp, filterNodes, generateTreeText, getFileIcon };
