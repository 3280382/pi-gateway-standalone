/**
 * AppHeader - Chat Top Menu (Two-Row Layout)
 *
 * 职责：
 * - Row 1: Working Directory, PID/Status
 * - Row 2: Search Box
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import {
  selectSearchFilters,
  selectSearchQuery,
  useChatStore,
} from "@/features/chat/stores/chatStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { formatSessionId } from "@/features/chat/utils/sessionUtils";
import type { ChatSearchFilters } from "@/features/chat/types/chat";
import styles from "./AppHeader.module.css";

// ============================================================================
// Types
// ============================================================================

interface AppHeaderProps {
  currentView?: "chat" | "files";
  searchQuery?: string;
  searchFilters?: {
    user: boolean;
    assistant: boolean;
    system: boolean;
    thinking: boolean;
    tools: boolean;
    compaction: boolean;
    modelChange: boolean;
    thinkingLevelChange: boolean;
    usage: boolean;
  };
  onSearchQueryChange?: (query: string) => void;
  onSearchFiltersChange?: (filters: {
    user: boolean;
    assistant: boolean;
    system: boolean;
    thinking: boolean;
    tools: boolean;
    compaction: boolean;
    modelChange: boolean;
    thinkingLevelChange: boolean;
    usage: boolean;
  }) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AppHeader({
  currentView = "chat",
  searchQuery: externalSearchQuery,
  searchFilters: externalSearchFilters,
  onSearchQueryChange,
  onSearchFiltersChange,
}: AppHeaderProps) {
  // ========== 1. State (Domain State from Zustand) ==========
  const sessionStore = useSessionStore();
  // 使用全局 workspaceStore 的 workingDir
  const workingDir = useWorkspaceStore((state) => state.workingDir) ?? "/root";
  const serverPid = sessionStore.serverPid;
  const isConnected = sessionStore.isConnected;

  // Search state from store
  const chatStoreQuery = useChatStore(selectSearchQuery);
  const chatStoreFilters = useChatStore(selectSearchFilters);
  const chatStoreSetSearchQuery = useChatStore((s) => s.setSearchQuery);
  const chatStoreSetSearchFilters = useChatStore((s) => s.setSearchFilters);

  // UI State (Local)
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);

  // ========== 2. Derived Values ==========
  const connectionStatus = isConnected ? "connected" : "disconnected";
  const pid = serverPid;
  const searchQuery = externalSearchQuery ?? chatStoreQuery;
  const filters = externalSearchFilters ?? chatStoreFilters;

  // 当前会话 ID 和运行状态
  const sidebarStore = useSidebarStore();
  const currentSessionId = sidebarStore.selectedSessionId;
  const runtimeStatus = currentSessionId ? sidebarStore.runtimeStatus[currentSessionId] : null;

  // ========== 3. Computed ==========
  const hasActiveFilters = useMemo(
    () =>
      filters.user ||
      filters.assistant ||
      filters.system ||
      filters.thinking ||
      filters.tools ||
      filters.compaction ||
      filters.modelChange ||
      filters.thinkingLevelChange ||
      filters.usage,
    [filters]
  );

  const activeFilterCount = useMemo(
    () =>
      [
        filters.user,
        filters.assistant,
        filters.system,
        filters.thinking,
        filters.tools,
        filters.compaction,
        filters.modelChange,
        filters.thinkingLevelChange,
        filters.usage,
      ].filter(Boolean).length,
    [filters]
  );

  // Directory browser modal
  const isDirectoryBrowserOpen = useModalStore((state) => state.isDirectoryBrowserOpen);
  const openDirectoryBrowser = useModalStore((state) => state.openDirectoryBrowser);
  const closeDirectoryBrowser = useModalStore((state) => state.closeDirectoryBrowser);

  // ========== 4. Actions ==========
  const handleFilterChange = useCallback(
    (key: keyof ChatSearchFilters) => {
      if (onSearchFiltersChange) {
        onSearchFiltersChange({ ...filters, [key]: !filters[key] });
      } else {
        chatStoreSetSearchFilters({ [key]: !filters[key] });
      }
    },
    [filters, onSearchFiltersChange, chatStoreSetSearchFilters]
  );

  // ========== 5. Effects ==========
  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(`.${styles.filterDropdown}`) &&
        !target.closest(`.${styles.filterToggle}`)
      ) {
        setIsFiltersVisible(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // ========== 6. Render ==========
  return (
    <div className={styles.topBar}>
      {/* Row 1: 工作目录（最大宽度） */}
      <div className={styles.topRow}>
        {/* 工作目录按钮 - 宽度最大 */}
        <button
          type="button"
          className={`${styles.workingDirBtn} ${styles.workingDirBtnFullWidth}`}
          onClick={() => openDirectoryBrowser()}
          title={`Working Directory: ${workingDir || "Click to select"}`}
        >
          <FolderIcon />
          <span className={styles.btnText}>{workingDir || "Select Directory"}</span>
        </button>
      </div>

      {/* Row 2: 搜索框 + PID */}
      <div className={styles.bottomRow}>
        {/* 搜索 */}
        <div className={styles.searchWrapper}>
          <SearchIcon className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => {
              if (onSearchQueryChange) {
                onSearchQueryChange(e.target.value);
              } else {
                chatStoreSetSearchQuery(e.target.value);
              }
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                if (onSearchQueryChange) {
                  onSearchQueryChange("");
                } else {
                  chatStoreSetSearchQuery("");
                }
              }}
              title="Clear"
            >
              <XIcon />
            </button>
          )}
          {/* 过滤按钮 */}
          <button
            type="button"
            className={`${styles.filterToggle} ${hasActiveFilters ? styles.active : ""}`}
            onClick={() => setIsFiltersVisible(!isFiltersVisible)}
            title="Filters"
          >
            <FilterIcon />
            {hasActiveFilters && <span className={styles.filterCount}>{activeFilterCount}</span>}
          </button>

          {/* Filter dropdown */}
          {isFiltersVisible && (
            <div className={styles.filterDropdown}>
              <FilterChip
                label="User"
                checked={filters.user}
                onChange={() => handleFilterChange("user")}
              />
              <FilterChip
                label="Assistant"
                checked={filters.assistant}
                onChange={() => handleFilterChange("assistant")}
              />
              <FilterChip
                label="System"
                checked={filters.system}
                onChange={() => handleFilterChange("system")}
              />
              <FilterChip
                label="Thinking"
                checked={filters.thinking}
                onChange={() => handleFilterChange("thinking")}
              />
              <FilterChip
                label="Tools"
                checked={filters.tools}
                onChange={() => handleFilterChange("tools")}
              />
              <FilterChip
                label="Compaction"
                checked={filters.compaction}
                onChange={() => handleFilterChange("compaction")}
              />
              <FilterChip
                label="Model Change"
                checked={filters.modelChange}
                onChange={() => handleFilterChange("modelChange")}
              />
              <FilterChip
                label="Thinking Level"
                checked={filters.thinkingLevelChange}
                onChange={() => handleFilterChange("thinkingLevelChange")}
              />
              <FilterChip
                label="Usage"
                checked={filters.usage}
                onChange={() => handleFilterChange("usage")}
              />
            </div>
          )}
        </div>

        <div className={styles.spacer} />

        {/* 会话 ID + 运行状态 + 连接状态 + PID */}
        <div className={styles.statusGroup}>
          {currentSessionId && (
            <div 
              className={styles.sessionInfo} 
              title={`Session: ${currentSessionId}${runtimeStatus ? ` (${runtimeStatus})` : ""}`}
            >
              <span className={styles.sessionId}>{formatSessionId(currentSessionId)}</span>
              {runtimeStatus && (
                <span className={`${styles.runtimeStatus} ${styles[runtimeStatus]}`}>
                  {runtimeStatus === "thinking" && "🤔"}
                  {runtimeStatus === "tooling" && "🔧"}
                  {runtimeStatus === "streaming" && "📝"}
                  {runtimeStatus === "waiting" && "⏳"}
                  {runtimeStatus === "idle" && "💤"}
                  {runtimeStatus === "error" && "❌"}
                </span>
              )}
            </div>
          )}
          <div className={styles.status} title={`${connectionStatus}${pid ? ` (PID: ${pid})` : ""}`}>
            <span className={`${styles.statusDot} ${styles[connectionStatus]}`} />
            {pid && <span className={styles.pid}>{pid}</span>}
          </div>
        </div>
      </div>

      {/* Directory Picker Modal */}
      {isDirectoryBrowserOpen && (
        <DirectoryPickerModal currentPath={workingDir || "/root"} onClose={closeDirectoryBrowser} />
      )}
    </div>
  );
}

// Filter Chip Component
function FilterChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.filterChip} ${checked ? styles.checked : ""}`}
      onClick={onChange}
    >
      {checked && <CheckIcon />}
      <span>{label}</span>
    </button>
  );
}

// Icons
function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DropdownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Directory Picker Modal
// 默认排除的目录（与 TreeView 保持一致）
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

// 检查是否应该排除某个目录
function shouldExcludeDir(name: string): boolean {
  // 排除隐藏目录（以.开头）
  if (name.startsWith(".")) {
    // 但允许 .pi（特殊目录）
    return name !== ".pi";
  }
  // 排除默认列表中的目录
  return DEFAULT_EXCLUDED_DIRS.includes(name.toLowerCase());
}

function DirectoryPickerModal({
  currentPath,
  onClose,
}: {
  currentPath: string;
  onClose: () => void;
}) {
  const homeDir = "/root";
  const [path, setPath] = useState(homeDir);
  const [entries, setEntries] = useState<
    Array<{ name: string; path: string; isDirectory: boolean }>
  >([]);
  const [loading, setLoading] = useState(false);
  const sidebarController = useSidebarController();

  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/files/file/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath }),
      });
      const data = await response.json();
      const dirs = data.items
        .filter((item: any) => item.isDirectory && !shouldExcludeDir(item.name))
        .map((item: any) => ({
          name: item.name,
          path: item.path,
          isDirectory: true,
        }));

      // 添加上级目录按钮（如果不在根目录）
      if (data.parentPath !== data.currentPath && data.currentPath !== "/") {
        dirs.unshift({
          name: "..",
          path: data.parentPath,
          isDirectory: true,
        });
      }

      // 添加快速导航到 home 目录按钮（如果当前不在 home）
      if (data.currentPath !== homeDir && homeDir !== "/") {
        dirs.unshift({
          name: "🏠 ~ (home)",
          path: homeDir,
          isDirectory: true,
        });
      }

      // 排序：.. 在最前面，然后是 home 按钮，其他按字母排序
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
      console.error("Failed to load directory:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 每次打开时从 home 目录开始
  useEffect(() => {
    loadDirectory(homeDir);
  }, [loadDirectory]);

  const handleSelect = async () => {
    if (path && path !== currentPath) {
      await sidebarController.changeWorkingDir(path);
    }
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.pickerHeader}>
          <h4>Select Working Directory</h4>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <div className={styles.currentPath}>{path}</div>
        <div className={styles.pickerActions}>
          <button type="button" className={styles.selectBtn} onClick={handleSelect}>
            Select This Directory
          </button>
        </div>
        <div className={styles.entriesList}>
          {loading ? (
            <div className={styles.loadingItem}>Loading...</div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.path}
                className={styles.entry}
                onClick={() => loadDirectory(entry.path)}
              >
                <FolderIcon />
                <span>{entry.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
