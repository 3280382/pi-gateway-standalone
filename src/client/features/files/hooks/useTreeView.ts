/**
 * useTreeView - 树形视图数据获取 Hook
 *
 * 职责：为TreeView组件提供全量静态树形数据
 * 一次性加载完整目录树，非异步按需加载
 * 过滤状态从FileStore读取
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as fileApi from "@/features/files/services/api/fileApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { TreeNode } from "@/features/files/types";

export interface UseTreeViewResult {
  // 数据
  treeData: TreeNode[];
  browsePath: string;
  
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

export function useTreeView(): UseTreeViewResult {
  const [rawTreeData, setRawTreeData] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentBrowsePath, treeFilterMode, treeFilterText } = useFileStore();
  
  const lastPathRef = useRef<string>("");

  // 加载全量树数据（一次性静态加载）
  const refresh = useCallback(async (pathToLoad: string) => {
    if (!pathToLoad || pathToLoad === lastPathRef.current) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fileApi.tree(pathToLoad);
      setRawTreeData(response.items);
      lastPathRef.current = pathToLoad;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load tree";
      setError(errorMsg);
      console.error("[useTreeView] Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 当浏览路径变化时自动刷新，使用 ref 防止重复加载
  useEffect(() => {
    const path = currentBrowsePath;
    if (path && path !== lastPathRef.current) {
      refresh(path);
    }
  }, [currentBrowsePath, refresh]);

  // 应用过滤
  const treeData = useMemo(() => {
    return filterTreeNodes(rawTreeData, treeFilterMode, treeFilterText);
  }, [rawTreeData, treeFilterMode, treeFilterText]);

  return {
    treeData,
    browsePath: currentBrowsePath,
    isLoading,
    error,
    refresh: () => refresh(currentBrowsePath),
  };
}
