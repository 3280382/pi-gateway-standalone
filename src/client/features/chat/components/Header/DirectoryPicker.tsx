/**
 * DirectoryPicker - directories选择器Group件
 *
 * Responsibilities:
 * - 显示directoriesCols表供用户选择
 * - 支持进入子directories和返回上级
 * - 过滤不必要的directories（node_modules, .git 等）
 * - 每次打开从 home directories开始
 *
 * Structure:State → Ref → Effects → Computed → Actions → Render
 */

import { useCallback, useEffect, useState } from "react";
import styles from "./AppHeader.module.css";

// ============================================================================
// Constants
// ============================================================================

// 默认排除的directories（与 TreeView 保持一致）
const DEFAULT_EXCLUDED_DIRS = [
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
  "log",
  "logs",
  "fonts",
  ".pi",
  ".cache",
  "out",
  "target", // Rust/Java build
  "bin",
  "obj",
  "vendor", // PHP/Go dependencies
  "tmp",
  "temp",
];

// Home directories
const HOME_DIR = "/root";

// 检查是否应该排除某个directories
function shouldExcludeDir(name: string): boolean {
  // 排除Hiddendirectories（以.开头）
  if (name.startsWith(".")) {
    // 但允许 .pi（特殊directories）
    return name !== ".pi";
  }
  // 排除默认Cols表中的directories
  return DEFAULT_EXCLUDED_DIRS.includes(name.toLowerCase());
}

// ============================================================================
// Types
// ============================================================================

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface DirectoryPickerProps {
  currentPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DirectoryPicker({ currentPath, onSelect, onClose }: DirectoryPickerProps) {
  // ========== 1. State ==========
  // 每次打开都从 home directories开始
  const [path, setPath] = useState(HOME_DIR);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ========== 4. Actions ==========
  const loadDirectory = useCallback(async (dirPath: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/files/file/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath }),
      });
      const data = await response.json();

      // 过滤directories：只显示非排除的directories
      const dirs = data.items
        .filter((item: any) => item.isDirectory && !shouldExcludeDir(item.name))
        .map((item: any) => ({
          name: item.name,
          path: item.path,
          isDirectory: true,
        }));

      // 添加上级directories按钮（如果不在根directories）
      if (data.parentPath !== data.currentPath && data.currentPath !== "/") {
        dirs.unshift({
          name: "..",
          path: data.parentPath,
          isDirectory: true,
        });
      }

      // 添加快速导航到 home directories按钮（如果当前不在 home）
      if (data.currentPath !== HOME_DIR && HOME_DIR !== "/") {
        dirs.unshift({
          name: "🏠 ~ (home)",
          path: HOME_DIR,
          isDirectory: true,
        });
      }

      // Sort：.. 在最前面，然后是 home 按钮，其他按字母Sort
      dirs.sort((a: any, b: any) => {
        if (a.name === "..") return -1;
        if (b.name === "..") return 1;
        if (a.name.includes("🏠")) return -1;
        if (b.name.includes("🏠")) return 1;
        return a.name.localeCompare(b.name);
      });

      setEntries(dirs);
      setPath(data.currentPath);
    } catch (error) {
      console.error("[DirectoryPicker] Failed to load directory:", error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ========== 3. Effects ==========
  // 每次打开都从 home directories开始
  useEffect(() => {
    loadDirectory(HOME_DIR);
  }, [loadDirectory]);

  // ========== 6. Render ==========
  return (
    <div className={styles.pickerOverlay} onClick={onClose}>
      <div className={styles.picker} onClick={(e) => e.stopPropagation()}>
        <div className={styles.pickerHeader}>
          <h4>Select Working Directory</h4>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.currentPath}>{path}</div>

        {/* 快速导航按钮 */}
        <div className={styles.quickNav}>
          {path !== HOME_DIR && (
            <button
              type="button"
              className={styles.quickNavBtn}
              onClick={() => loadDirectory(HOME_DIR)}
            >
              🏠 Home
            </button>
          )}
          {path !== "/" && (
            <button type="button" className={styles.quickNavBtn} onClick={() => loadDirectory("/")}>
              / Root
            </button>
          )}
        </div>

        <div className={styles.pickerActions}>
          <button type="button" className={styles.selectBtn} onClick={() => onSelect(path)}>
            Select This Directory
          </button>
        </div>
        <div className={styles.entriesList}>
          {isLoading ? (
            <div className={styles.pickerLoading}>Loading...</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.path}
                className={styles.entry}
                onClick={() => loadDirectory(entry.path)}
              >
                <FolderIcon className={styles.entryIcon} />
                <span className={styles.entryName}>{entry.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
    >
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}
