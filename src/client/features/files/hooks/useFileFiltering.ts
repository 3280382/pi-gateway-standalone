/**
 * useFileFiltering - files过滤和Sort逻辑 Hook
 *
 * Responsibilities:管理filesCols表的过滤和Sort逻辑
 */

import { useMemo } from "react";
import type { FileItem, FilterType } from "@/features/files/stores/fileStore";
import { useFileStore } from "@/features/files/stores/fileStore";

export interface UseFileFilteringResult {
  filteredItems: FileItem[];
  hasActiveFilter: boolean;
  filterCount: number;
}

// 扩展名映射表
const EXTENSION_MAPPINGS: Record<FilterType, string[]> = {
  all: [],
  dir: [],
  text: ["txt", "log", "csv"],
  html: ["html", "htm", "css", "scss", "sass", "less"],
  js: ["js", "ts", "jsx", "tsx", "mjs", "cjs"],
  py: ["py", "pyw", "ipynb"],
  sh: ["sh", "bash", "zsh", "fish"],
  java: ["java", "class", "jar"],
  json: ["json", "yaml", "yml", "xml"],
  md: ["md", "mdx", "markdown"],
  image: ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"],
  code: [
    "js",
    "ts",
    "jsx",
    "tsx",
    "py",
    "java",
    "cpp",
    "c",
    "h",
    "go",
    "rs",
    "php",
    "rb",
    "swift",
    "kt",
  ],
  media: ["png", "jpg", "jpeg", "gif", "svg", "mp4", "mp3", "webp", "mov", "avi"],
  doc: ["md", "txt", "doc", "docx", "pdf", "rtf"],
  custom: [],
};

/**
 * 检查files是否匹配过滤类型
 */
function matchesFilterType(item: FileItem, filterType: FilterType): boolean {
  if (filterType === "all") return true;
  if (filterType === "dir") return item.isDirectory;

  const exts = EXTENSION_MAPPINGS[filterType] || [];
  if (exts.length === 0) return true;

  const ext = item.extension?.toLowerCase() || "";
  return exts.includes(ext);
}

/**
 * 检查files是否匹配Search文本
 */
function matchesSearchText(item: FileItem, searchText: string): boolean {
  if (!searchText) return true;
  const text = searchText.toLowerCase();
  return item.name.toLowerCase().includes(text);
}

/**
 * 比较两  items项进RowsSort
 */
function compareItems(a: FileItem, b: FileItem, sortMode: string): number {
  // ".." 始终排在Page一位
  if (a.name === "..") return -1;
  if (b.name === "..") return 1;

  // directories始终在files前面
  if (a.isDirectory && !b.isDirectory) return -1;
  if (!a.isDirectory && b.isDirectory) return 1;

  switch (sortMode) {
    case "name-asc":
      return a.name.localeCompare(b.name);
    case "name-desc":
      return b.name.localeCompare(a.name);
    case "time-desc":
      return (b.modified || "").localeCompare(a.modified || "");
    case "time-asc":
      return (a.modified || "").localeCompare(b.modified || "");
    case "size-desc":
      return (b.size || 0) - (a.size || 0);
    case "size-asc":
      return (a.size || 0) - (b.size || 0);
    case "type":
      return (a.extension || "").localeCompare(b.extension || "");
    default:
      return 0;
  }
}

export function useFileFiltering(): UseFileFilteringResult {
  const { items, filterText, filterType, sortMode } = useFileStore();

  const result = useMemo(() => {
    let filtered = [...items];

    // 应用Search过滤
    if (filterText) {
      filtered = filtered.filter((item) => matchesSearchText(item, filterText));
    }

    // 应用类型过滤
    if (filterType !== "all") {
      filtered = filtered.filter((item) => matchesFilterType(item, filterType));
    }

    // 应用Sort
    filtered.sort((a, b) => compareItems(a, b, sortMode));

    const hasActiveFilter = filterText !== "" || filterType !== "all" || sortMode !== "time-desc";

    return {
      filteredItems: filtered,
      hasActiveFilter,
      filterCount: items.length - filtered.length,
    };
  }, [items, filterText, filterType, sortMode]);

  return result;
}
