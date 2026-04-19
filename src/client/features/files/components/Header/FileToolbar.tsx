import { useEffect, useRef, useState } from "react";
import styles from "@/features/files/components/FileBrowser/FileBrowser.module.css";
import { type FilterType, type SortMode, useFileStore } from "@/features/files/stores/fileStore";

// Grid/List 过滤选项定义
const FILTER_OPTIONS: { value: FilterType; icon: string; label: string }[] = [
  { value: "all", icon: "📁", label: "All Files" },
  { value: "dir", icon: "📂", label: "Directories" },
  { value: "text", icon: "📄", label: "Text Files" },
  { value: "html", icon: "🌐", label: "HTML/CSS" },
  { value: "js", icon: "📜", label: "JavaScript/TS" },
  { value: "py", icon: "🐍", label: "Python" },
  { value: "sh", icon: "⚡", label: "Shell Scripts" },
  { value: "java", icon: "☕", label: "Java" },
  { value: "json", icon: "📋", label: "JSON/Data" },
  { value: "md", icon: "📝", label: "Markdown" },
  { value: "image", icon: "🖼️", label: "Images" },
  { value: "code", icon: "💻", label: "All Code" },
];

// TreeView 过滤选项定义
const TREE_FILTER_OPTIONS: { value: "normal" | "all" | "search"; icon: string; label: string }[] = [
  { value: "normal", icon: "🙈", label: "Exclude Hidden" },
  { value: "all", icon: "👁️", label: "Show All" },
  { value: "search", icon: "🔍", label: "Search..." },
];

// Sort选项定义
const SORT_OPTIONS: { value: SortMode; icon: string; label: string }[] = [
  { value: "time-desc", icon: "🕐", label: "Time ↓" },
  { value: "time-asc", icon: "🕐", label: "Time ↑" },
  { value: "name-asc", icon: "🔤", label: "Name A-Z" },
  { value: "name-desc", icon: "🔤", label: "Name Z-A" },
  { value: "size-desc", icon: "📊", label: "Size ↓" },
  { value: "size-asc", icon: "📊", label: "Size ↑" },
  { value: "type", icon: "📎", label: "Type" },
];

interface FileToolbarProps {
  workingDir: string;
  onRefresh?: () => void;
  onNavigate?: (path: string) => void;
}

export function FileToolbar({ workingDir, onRefresh, onNavigate }: FileToolbarProps) {
  // ========== 1. State ==========
  const {
    viewMode,
    sortMode,
    filterType,
    filterText,
    treeFilterMode,
    treeFilterText,
    setSortMode,
    setFilterType,
    setFilterText,
    setTreeFilterMode,
    setTreeFilterText,
  } = useFileStore();

  // 判断是否是TreeView模式
  const isTreeView = viewMode === "tree";

  // UI状态
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // ========== 2. Ref ==========
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // ========== 3. Effects ==========
  // 点击外部Close下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ========== 4. Computed ==========
  // 获取当前选中的选项
  const selectedFilterOption =
    FILTER_OPTIONS.find((opt) => opt.value === filterType) || FILTER_OPTIONS[0];

  // TreeView过滤选项显示文本
  const selectedTreeFilter =
    treeFilterMode === "normal"
      ? "🙈 Exclude Hidden"
      : treeFilterMode === "all"
        ? "👁️ Show All"
        : "🔍 Search...";

  // ========== 5. Actions ==========
  // 处理输入框变化
  const handleFilterInputChange = (value: string) => {
    if (isTreeView) {
      // TreeView模式：Search文本
      setTreeFilterText(value);
      if (value) {
        setTreeFilterMode("search");
      } else {
        setTreeFilterMode("normal");
      }
    } else {
      // Grid/List模式
      const option = FILTER_OPTIONS.find((opt) => opt.label.toLowerCase() === value.toLowerCase());
      if (option) {
        setFilterType(option.value);
        setFilterText("");
      } else {
        setFilterType("custom");
        setFilterText(value);
      }
    }
  };

  return (
    <div className={styles.toolbarWrapper}>
      {/* Page一行：路径 */}
      <div className={styles.toolbarRow}>
        <div className={styles.pathBar}>
          <PathIcon />
          <span>{workingDir}</span>
        </div>
      </div>
      {/* Page二行：过滤 + Sort */}
      <div className={styles.toolbarRow}>
        {/* 过滤 */}
        <div className={styles.filterCombo} ref={filterDropdownRef}>
          <input
            type="text"
            className={styles.filterComboInput}
            placeholder="Filter..."
            value={
              isTreeView
                ? treeFilterMode === "search"
                  ? treeFilterText
                  : selectedTreeFilter
                : filterType === "custom"
                  ? filterText
                  : selectedFilterOption.label
            }
            onChange={(e) => handleFilterInputChange(e.target.value)}
            onClick={() => setIsFilterDropdownOpen(true)}
          />
          <button
            type="button"
            className={styles.filterComboBtn}
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            title="Select filter"
          >
            <DropdownIcon />
          </button>
          {isFilterDropdownOpen && (
            <div className={styles.filterDropdown}>
              {isTreeView
                ? // TreeView 过滤选项
                  TREE_FILTER_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className={`${styles.filterDropdownItem} ${treeFilterMode === option.value ? styles.active : ""}`}
                      onClick={() => {
                        setTreeFilterMode(option.value);
                        if (option.value !== "search") {
                          setTreeFilterText("");
                        }
                        setIsFilterDropdownOpen(false);
                      }}
                    >
                      <span className={styles.filterIcon}>{option.icon}</span>
                      <span className={styles.filterLabel}>{option.label}</span>
                    </div>
                  ))
                : // Grid/List 过滤选项
                  FILTER_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className={`${styles.filterDropdownItem} ${filterType === option.value ? styles.active : ""}`}
                      onClick={() => {
                        setFilterType(option.value);
                        if (option.value !== "custom") {
                          setFilterText("");
                        }
                        setIsFilterDropdownOpen(false);
                      }}
                    >
                      <span className={styles.filterIcon}>{option.icon}</span>
                      <span className={styles.filterLabel}>{option.label}</span>
                    </div>
                  ))}
            </div>
          )}
        </div>

        {/* Sort */}
        <div className={styles.sortCombo} ref={sortDropdownRef}>
          <button
            type="button"
            className={styles.sortComboBtn}
            onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
            title="Sort by"
          >
            <span>{SORT_OPTIONS.find((opt) => opt.value === sortMode)?.icon}</span>
            <span>{SORT_OPTIONS.find((opt) => opt.value === sortMode)?.label}</span>
            <DropdownIcon />
          </button>
          {isSortDropdownOpen && (
            <div className={styles.sortDropdown}>
              {SORT_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`${styles.sortDropdownItem} ${sortMode === option.value ? styles.active : ""}`}
                  onClick={() => {
                    setSortMode(option.value);
                    setIsSortDropdownOpen(false);
                  }}
                >
                  <span className={styles.sortIcon}>{option.icon}</span>
                  <span className={styles.sortLabel}>{option.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Icons
function PathIcon() {
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
