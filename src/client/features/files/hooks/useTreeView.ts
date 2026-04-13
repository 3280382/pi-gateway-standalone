/**
 * useTreeView - 树形视图数据获取 Hook
 *
 * 职责：为TreeView组件提供全量静态树形数据
 * 一次性加载完整目录树，非异步按需加载
 */

import { useCallback, useEffect, useState } from "react";
import * as fileApi from "@/features/files/services/api/fileApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import type { TreeNode } from "@/features/files/types";

export type FilterMode = "normal" | "all" | "search";

export interface UseTreeViewResult {
  // 数据
  treeData: TreeNode[];
  workingDir: string;
  
  // 过滤
  filterMode: FilterMode;
  searchText: string;
  setFilterMode: (mode: FilterMode) => void;
  setSearchText: (text: string) => void;
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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

/** 过滤树节点 */
function filterTreeNodes(
  items: TreeNode[],
  mode: FilterMode,
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

export function useTreeView(): UseTreeViewResult {
  const [rawTreeData, setRawTreeData] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("normal");
  const [searchText, setSearchText] = useState("");
  const { workingDir, items } = useFileStore();

  // 加载全量树数据（一次性静态加载）
  const refresh = useCallback(async () => {
    if (!workingDir) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // 使用tree API加载全量静态树
      const response = await fileApi.tree(workingDir);
      setRawTreeData(response.items);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load tree";
      setError(errorMsg);
      console.error("[useTreeView] Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workingDir]);

  // 当workingDir变化时自动刷新
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 应用过滤
  const treeData = filterTreeNodes(rawTreeData, filterMode, searchText);

  return {
    treeData,
    workingDir,
    filterMode,
    searchText,
    setFilterMode,
    setSearchText,
    isLoading,
    error,
    refresh,
  };
}
