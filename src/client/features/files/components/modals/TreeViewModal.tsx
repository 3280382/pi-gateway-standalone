/**
 * TreeViewModal - 紧凑全屏树状目录浏览模态窗口
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import styles from "./TreeViewModal.module.css";

export interface TreeNode {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

export interface TreeViewModalProps {
  isOpen: boolean;
  treeData: { path: string; items: TreeNode[] } | null;
  treeLoading: boolean;
  onClose: () => void;
  onFileClick: (path: string, name: string) => void;
}

const DEFAULT_EXCLUDES = [
  "node_modules", "__pycache__", ".git", ".svn", ".hg",
  "dist", "build", ".next", ".nuxt", "coverage",
  ".coverage", ".idea", ".vscode",
];

type FilterMode = "normal" | "all" | "search";

function getFileIcon(name: string, isDirectory: boolean): string {
  if (isDirectory) return "📁";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    js: "📜", ts: "📘", jsx: "⚛️", tsx: "⚛️", py: "🐍",
    java: "☕", go: "🔵", rs: "🦀", c: "🔧", cpp: "🔧",
    h: "📋", hpp: "📋", cs: "🔷", php: "🐘", rb: "💎",
    sh: "🐚", bash: "🐚", html: "🌐", json: "📋",
    yaml: "📋", yml: "📋", md: "📝", css: "🎨",
    scss: "🎨", png: "🖼️", jpg: "🖼️", svg: "🎨",
    txt: "📄", pdf: "📕", zip: "📦", "7z": "📦",
  };
  return icons[ext] || "📄";
}

function filterNodes(items: TreeNode[], mode: FilterMode, search: string): TreeNode[] {
  return items.map(item => {
    if (mode === "search" && search) {
      const matches = item.name.toLowerCase().includes(search.toLowerCase());
      if (matches) return item;
      if (item.children) {
        const filtered = filterNodes(item.children, mode, search);
        if (filtered.length) return { ...item, children: filtered };
      }
      return null;
    }
    if (mode === "normal") {
      if (item.name.startsWith(".")) return null;
      if (DEFAULT_EXCLUDES.includes(item.name)) return null;
    }
    if (item.children) {
      return { ...item, children: filterNodes(item.children, mode, search) };
    }
    return item;
  }).filter(Boolean) as TreeNode[];
}

function generateTreeLines(items: TreeNode[], prefix = ""): string[] {
  const lines: string[] = [];
  items.forEach((item, idx) => {
    const isLast = idx === items.length - 1;
    const connector = isLast ? "`-- " : "|-- ";
    const icon = getFileIcon(item.name, item.isDirectory);
    lines.push(prefix + connector + icon + " " + item.name);
    if (item.children?.length) {
      const childPrefix = prefix + (isLast ? "    " : "|   ");
      lines.push(...generateTreeLines(item.children, childPrefix));
    }
  });
  return lines;
}

export function TreeViewModal({
  isOpen, treeData, treeLoading, onClose, onFileClick,
}: TreeViewModalProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("normal");
  const [searchText, setSearchText] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const filteredItems = useMemo(() => {
    if (!treeData) return [];
    return filterNodes(treeData.items, filterMode, searchText);
  }, [treeData, filterMode, searchText]);

  const treeText = useMemo(() => {
    if (!treeData) return "";
    return treeData.path + "\n" + generateTreeLines(filteredItems).join("\n");
  }, [treeData, filteredItems]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(treeText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  }, [treeText]);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className={styles.header}>
          <div className={styles.row}>
            <span className={styles.path}>{treeData?.path || "."}</span>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div className={styles.row}>
            <select
              className={styles.select}
              value={filterMode}
              onChange={e => {
                setFilterMode(e.target.value as FilterMode);
                if (e.target.value !== "search") setSearchText("");
              }}
            >
              <option value="normal">隐藏排除文件</option>
              <option value="all">显示所有</option>
              <option value="search">搜索过滤...</option>
            </select>
            {filterMode === "search" && (
              <input
                className={styles.searchInput}
                placeholder="输入过滤文字..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                autoFocus
              />
            )}
            <button 
              className={`${styles.copyBtn} ${copySuccess ? styles.copied : ""}`}
              onClick={handleCopy}
              disabled={!filteredItems.length}
            >
              {copySuccess ? "✓ 已复制" : "📋 复制"}
            </button>
          </div>
        </div>

        {/* 树内容 - 使用 <pre> 标签确保格式 */}
        <div className={styles.content}>
          {treeLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <InteractiveTree
              items={filteredItems}
              onFileClick={onFileClick}
              searchText={searchText}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// 交互式树组件
function InteractiveTree({
  items,
  onFileClick,
  searchText,
  prefix = "",
}: {
  items: TreeNode[];
  onFileClick: (path: string, name: string) => void;
  searchText: string;
  prefix?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // 默认展开前6层
    const initial = new Set<string>();
    const addToLevel6 = (nodes: TreeNode[], level: number) => {
      if (level >= 6) return;
      nodes.forEach(n => {
        if (n.isDirectory && n.children?.length) {
          initial.add(n.path);
          addToLevel6(n.children, level + 1);
        }
      });
    };
    addToLevel6(items, 0);
    return initial;
  });

  const toggle = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  if (!items.length) return <div className={styles.empty}>无内容</div>;

  return (
    <>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const connector = isLast ? "`-- " : "|-- ";
        const isExpanded = expanded.has(item.path);
        const hasChildren = item.children && item.children.length > 0;
        const childPrefix = prefix + (isLast ? "    " : "|   ");
        const icon = getFileIcon(item.name, item.isDirectory);

        // 处理搜索高亮
        let displayName: React.ReactNode = item.name;
        if (searchText) {
          const parts = item.name.split(new RegExp(`(${searchText})`, "gi"));
          displayName = parts.map((p, i) => 
            p.toLowerCase() === searchText.toLowerCase() ? 
              <mark key={i} className={styles.highlight}>{p}</mark> : p
          );
        }

        return (
          <React.Fragment key={item.path}>
            <div 
              className={styles.treeLine}
              onClick={() => hasChildren ? toggle(item.path) : onFileClick(item.path, item.name)}
            >
              {/* 缩进前缀 */}
              <span className={styles.indent}>{prefix}</span>
              {/* 连接符 */}
              <span className={styles.connector}>{connector}</span>
              {/* 展开图标 */}
              <span className={styles.expandIcon}>
                {hasChildren ? (isExpanded ? "[-]" : "[+]") : "   "}
              </span>
              {/* 图标 */}
              <span className={styles.fileIcon}>{icon}</span>
              {/* 文件名 */}
              <span className={item.isDirectory ? styles.dirName : styles.fileName}>
                {displayName}
              </span>
            </div>
            {isExpanded && hasChildren && (
              <InteractiveTree
                items={item.children!}
                onFileClick={onFileClick}
                searchText={searchText}
                prefix={childPrefix}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
