/**
 * AppHeader - Chat Top Menu (Two-Row Layout)
 *
 * Responsibilities:
 * - Row 1: Working Directory, PID/Status
 * - Row 2: Search Box
 *
 * Structure:State → Ref → Effects → Computed → Actions → Render
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import {
  selectSearchFilters,
  selectSearchQuery,
  useChatStore,
} from "@/features/chat/stores/chatStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { ChatSearchFilters } from "@/features/chat/types/chat";
import { formatSessionId } from "@/features/chat/utils/sessionUtils";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import styles from "./AppHeader.module.css";

// ============================================================================
// Types
// ============================================================================

interface AppHeaderProps {
  currentView?: "chat" | "files";
  searchQuery?: string;
  searchFilters?: ChatSearchFilters;
  onSearchQueryChange?: (query: string) => void;
  onSearchFiltersChange?: (filters: ChatSearchFilters) => void;
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
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  // 最近工作directories
  const recentWorkspaces = useSidebarStore((state) => state.recentWorkspaces);
  const sidebarController = useSidebarController();

  // ========== 2. Derived Values ==========
  const connectionStatus = isConnected ? "connected" : "disconnected";
  const pid = serverPid;
  const searchQuery = externalSearchQuery ?? chatStoreQuery;
  const filters = externalSearchFilters ?? chatStoreFilters;

  // 当前会话 ID 和运Rows状态
  const sidebarStore = useSidebarStore();
  const currentSessionId = sidebarStore.selectedSessionId;
  const runtimeStatus = currentSessionId ? sidebarStore.runtimeStatus[currentSessionId] : null;

  // ========== 3. Computed ==========
  // Hierarchical filter state with defensive checks (new 3-level kind system)
  const safeFilters = useMemo(
    () => ({
      kind1: filters?.kind1 ?? { user: true, assistant: true, sysinfo: true },
      kind2: filters?.kind2 ?? {
        prompt: true,
        response: true,
        thinking: true,
        tool: true,
        event: true,
      },
      kind3: filters?.kind3 ?? {
        compaction: true,
        retry: true,
        autoRetry: true,
        modelChange: true,
        thinkingLevelChange: true,
        usage: true,
        toolSuccess: true,
        toolError: true,
        toolPending: true,
      },
    }),
    [filters]
  );

  const hasActiveFilters = useMemo(() => {
    const { kind1, kind2, kind3 } = safeFilters;
    return (
      Object.values(kind1).some(Boolean) ||
      Object.values(kind2).some(Boolean) ||
      Object.values(kind3).some(Boolean)
    );
  }, [safeFilters]);

  const activeFilterCount = useMemo(() => {
    const { kind1, kind2, kind3 } = safeFilters;
    return [...Object.values(kind1), ...Object.values(kind2), ...Object.values(kind3)].filter(
      Boolean
    ).length;
  }, [safeFilters]);

  // Check which kind1 sources are active to show relevant content types
  const activeKind1 = useMemo(
    () => ({
      user: safeFilters.kind1.user,
      assistant: safeFilters.kind1.assistant,
      sysinfo: safeFilters.kind1.sysinfo,
    }),
    [safeFilters.kind1]
  );

  // Directory browser modal
  const isDirectoryBrowserOpen = useModalStore((state) => state.isDirectoryBrowserOpen);
  const openDirectoryBrowser = useModalStore((state) => state.openDirectoryBrowser);
  const closeDirectoryBrowser = useModalStore((state) => state.closeDirectoryBrowser);

  // ========== 4. Actions ==========
  // Handle kind1 filter changes
  const handleKind1FilterChange = useCallback(
    (kind: keyof typeof safeFilters.kind1) => {
      const newFilters = {
        ...filters,
        kind1: {
          ...safeFilters.kind1,
          [kind]: !safeFilters.kind1[kind],
        },
      };
      if (onSearchFiltersChange) {
        onSearchFiltersChange(newFilters);
      } else {
        chatStoreSetSearchFilters({ kind1: { [kind]: !safeFilters.kind1[kind] } });
      }
    },
    [filters, safeFilters.kind1, onSearchFiltersChange, chatStoreSetSearchFilters]
  );

  // Handle kind2 filter changes
  const handleKind2FilterChange = useCallback(
    (kind2Type: keyof typeof safeFilters.kind2) => {
      const newFilters = {
        ...filters,
        kind2: {
          ...safeFilters.kind2,
          [kind2Type]: !safeFilters.kind2[kind2Type],
        },
      };
      if (onSearchFiltersChange) {
        onSearchFiltersChange(newFilters);
      } else {
        chatStoreSetSearchFilters({ kind2: { [kind2Type]: !safeFilters.kind2[kind2Type] } });
      }
    },
    [filters, safeFilters.kind2, onSearchFiltersChange, chatStoreSetSearchFilters]
  );

  // Handle kind3 filter changes
  const handleKind3FilterChange = useCallback(
    (kind3Type: keyof typeof safeFilters.kind3) => {
      const newFilters = {
        ...filters,
        kind3: {
          ...safeFilters.kind3,
          [kind3Type]: !safeFilters.kind3[kind3Type],
        },
      };
      if (onSearchFiltersChange) {
        onSearchFiltersChange(newFilters);
      } else {
        chatStoreSetSearchFilters({ kind3: { [kind3Type]: !safeFilters.kind3[kind3Type] } });
      }
    },
    [filters, safeFilters.kind3, onSearchFiltersChange, chatStoreSetSearchFilters]
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

  // Close workspace dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isWorkspaceDropdownOpen &&
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(e.target as Node)
      ) {
        setIsWorkspaceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isWorkspaceDropdownOpen]);

  // ========== 6. Render ==========
  return (
    <div className={styles.topBar}>
      {/* Row 1: 工作directories（最大Width度） */}
      <div className={styles.topRow}>
        {/* 工作directories按钮 - 点击显示最近工作directories下拉 */}
        <div ref={workspaceDropdownRef} style={{ position: "relative", flex: 1 }}>
          <button
            type="button"
            className={`${styles.workingDirBtn} ${styles.workingDirBtnFullWidth}`}
            onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
            title={`Working Directory: ${workingDir || "Click to select"}`}
          >
            <FolderIcon />
            <span className={styles.btnText}>{workingDir || "Select Directory"}</span>
            <span style={{ marginLeft: "auto", fontSize: "10px" }}>▼</span>
          </button>

          {/* Workspace Dropdown */}
          {isWorkspaceDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "4px",
                background: "#161b22",
                border: "1px solid rgba(48, 54, 61, 0.5)",
                borderRadius: "6px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                zIndex: 100,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {recentWorkspaces.length > 0 ? (
                recentWorkspaces.map((ws) => {
                  const isActive = ws.path === workingDir;
                  return (
                    <button
                      key={ws.path}
                      type="button"
                      className={`${styles.dropdownItem} ${isActive ? styles.active : ""}`}
                      onClick={() => {
                        if (!isActive) {
                          sidebarController.changeWorkingDir(ws.path);
                        }
                        setIsWorkspaceDropdownOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        width: "100%",
                        padding: "8px 12px",
                        border: "none",
                        background: "transparent",
                        color: "#c9d1d9",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "12px",
                      }}
                    >
                      <span>{isActive ? "📂" : "📁"}</span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ws.displayName}
                      </span>
                      {isActive && <span style={{ color: "#58a6ff", fontSize: "10px" }}>●</span>}
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: "8px 12px", fontSize: "12px", color: "#6e7681" }}>
                  No recent workspaces
                </div>
              )}
              <div
                style={{
                  borderTop: "1px solid rgba(48, 54, 61, 0.5)",
                  padding: "6px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsWorkspaceDropdownOpen(false);
                    openDirectoryBrowser();
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 12px",
                    border: "none",
                    background: "transparent",
                    color: "#58a6ff",
                    cursor: "pointer",
                    fontSize: "12px",
                    textAlign: "center",
                    borderRadius: "3px",
                  }}
                >
                  Browse...
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Search框 + PID */}
      <div className={styles.bottomRow}>
        {/* Search */}
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

          {/* Hierarchical Filter Dropdown */}
          {isFiltersVisible && (
            <div className={styles.filterDropdown}>
              {/* Level 1: Role Filters */}
              <div className={styles.filterSection}>
                <div className={styles.filterSectionTitle}>Message Source</div>
                <FilterChip
                  label="👤 User"
                  checked={safeFilters.kind1.user}
                  onChange={() => handleKind1FilterChange("user")}
                />
                <FilterChip
                  label="🤖 Assistant"
                  checked={safeFilters.kind1.assistant}
                  onChange={() => handleKind1FilterChange("assistant")}
                />
                <FilterChip
                  label="⚙️ Sysinfo"
                  checked={safeFilters.kind1.sysinfo}
                  onChange={() => handleKind1FilterChange("sysinfo")}
                />
              </div>

              {/* Level 2: Content Type Filters (shown based on active kind1) */}
              {activeKind1.user && (
                <div className={styles.filterSection}>
                  <div className={styles.filterSectionTitle}>User Content Types</div>
                  <FilterChip
                    label="Prompts"
                    checked={safeFilters.kind2.prompt}
                    onChange={() => handleKind2FilterChange("prompt")}
                  />
                </div>
              )}

              {activeKind1.assistant && (
                <div className={styles.filterSection}>
                  <div className={styles.filterSectionTitle}>Assistant Content Types</div>
                  <FilterChip
                    label="Response"
                    checked={safeFilters.kind2.response}
                    onChange={() => handleKind2FilterChange("response")}
                  />
                  <FilterChip
                    label="Thinking"
                    checked={safeFilters.kind2.thinking}
                    onChange={() => handleKind2FilterChange("thinking")}
                  />
                  <FilterChip
                    label="Tools"
                    checked={safeFilters.kind2.tool}
                    onChange={() => handleKind2FilterChange("tool")}
                  />
                  {/* Tool Status Sub-filters - shown when Tools is enabled */}
                  {safeFilters.kind2.tool && (
                    <div className={styles.subFilterGroup}>
                      <FilterChip
                        label="✓ Success"
                        checked={safeFilters.kind3.toolSuccess}
                        onChange={() => handleKind3FilterChange("toolSuccess")}
                      />
                      <FilterChip
                        label="✗ Error"
                        checked={safeFilters.kind3.toolError}
                        onChange={() => handleKind3FilterChange("toolError")}
                      />
                      <FilterChip
                        label="⏳ Pending"
                        checked={safeFilters.kind3.toolPending}
                        onChange={() => handleKind3FilterChange("toolPending")}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeKind1.sysinfo && (
                <div className={styles.filterSection}>
                  <div className={styles.filterSectionTitle}>Sysinfo Event Types</div>
                  <FilterChip
                    label="Compaction"
                    checked={safeFilters.kind3.compaction}
                    onChange={() => handleKind3FilterChange("compaction")}
                  />
                  <FilterChip
                    label="Retry"
                    checked={safeFilters.kind3.retry}
                    onChange={() => handleKind3FilterChange("retry")}
                  />
                  <FilterChip
                    label="Auto Retry"
                    checked={safeFilters.kind3.autoRetry}
                    onChange={() => handleKind3FilterChange("autoRetry")}
                  />
                  <FilterChip
                    label="Model Change"
                    checked={safeFilters.kind3.modelChange}
                    onChange={() => handleKind3FilterChange("modelChange")}
                  />
                  <FilterChip
                    label="Reasoning Level"
                    checked={safeFilters.kind3.thinkingLevelChange}
                    onChange={() => handleKind3FilterChange("thinkingLevelChange")}
                  />
                  <FilterChip
                    label="Usage"
                    checked={safeFilters.kind3.usage}
                    onChange={() => handleKind3FilterChange("usage")}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.spacer} />

        {/* 会话 ID + 运Rows状态 + 连接状态 + PID */}
        <div className={styles.statusGroup}>
          {currentSessionId && (
            <div
              className={styles.sessionInfo}
              title={`Session: ${currentSessionId}${runtimeStatus ? ` (${runtimeStatus})` : ""}`}
            >
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
              <span className={styles.sessionId}>{formatSessionId(currentSessionId)}</span>
            </div>
          )}
          <div
            className={styles.status}
            title={`${connectionStatus}${pid ? ` (PID: ${pid})` : ""}`}
          >
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

function _DropdownIcon() {
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

      // 添加上级directories按钮（如果不在根directories）
      if (data.parentPath !== data.currentPath && data.currentPath !== "/") {
        dirs.unshift({
          name: "..",
          path: data.parentPath,
          isDirectory: true,
        });
      }

      // 添加快速导航到 home directories按钮（如果当前不在 home）
      if (data.currentPath !== homeDir && homeDir !== "/") {
        dirs.unshift({
          name: "🏠 ~ (home)",
          path: homeDir,
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
      console.error("Failed to load directory:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 每次打开时从 home directories开始
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
