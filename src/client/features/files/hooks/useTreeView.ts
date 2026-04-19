/**
 * useTreeView - 树形视图数据获取 Hook
 *
 * Responsibilities:为TreeView组件提供全量静态树形数据
 * 服务端过滤（normal模式），客户端Search过滤
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as fileApi from "@/features/files/services/api/fileApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import type { TreeNode } from "@/features/files/types";

export interface UseTreeViewOptions {
  /** 是否处于激活状态 - 非激活时不加载数据 */
  isActive?: boolean;
}

export interface UseTreeViewResult {
  // 数据
  treeData: TreeNode[];
  browsePath: string;

  // 加载状态
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** 客户端Search过滤（服务端已完成排除项过滤） */
function filterTreeNodes( items: TreeNode[], search: string): TreeNode[] {
  if (!search) return  items;

  return  items.filter((item) => {
    return item.name.toLowerCase().includes(search.toLowerCase());
  });
}

export function useTreeView(options: UseTreeViewOptions = {}): UseTreeViewResult {
  const { isActive = true } = options;

  const [rawTreeData, setRawTreeData] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentBrowsePath, treeFilterMode, treeFilterText } = useFileStore();

  const lastPathRef = useRef<string>(currentBrowsePath || "");
  const lastFilterRef = useRef<string>("all");

  // 加载树数据（一次性静态加载，服务端过滤）
  const refresh = useCallback(async (pathToLoad: string, filter: "all" | "normal") => {
    if (!pathToLoad) return;

    // 使用 ref 防止重复加载相同路径和过滤Items件
    if (pathToLoad === lastPathRef.current && filter === lastFilterRef.current) return;

    // 立即更新 ref，防止并发请求
    lastPathRef.current = pathToLoad;
    lastFilterRef.current = filter;

    setIsLoading(true);
    setError(null);

    try {
      // 传递 filter 参数给服务端，在服务端进行过滤
      const response = await fileApi.tree(pathToLoad, filter);
      setRawTreeData(response. items);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load tree";
      setError(errorMsg);
      console.error("[useTreeView] Error:", err);
      // 出错时重置 ref，允许重试
      lastPathRef.current = "";
      lastFilterRef.current = "all";
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 当浏览路径或过滤模式变化时自动Refresh（仅在激活状态下）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isActive || !currentBrowsePath) {
      return;
    }
    // 根据 treeFilterMode 决定 filter 参数
    const filter = treeFilterMode === "normal" ? "normal" : "all";
    refresh(currentBrowsePath, filter);
  }, [isActive, currentBrowsePath, treeFilterMode]);

  // 应用客户端Search过滤（服务端已完成排除项过滤）
  const treeData = useMemo(() => {
    return filterTreeNodes(rawTreeData, treeFilterText);
  }, [rawTreeData, treeFilterText]);

  return {
    treeData,
    browsePath: currentBrowsePath,
    isLoading,
    error,
    refresh: () => refresh(currentBrowsePath, treeFilterMode === "normal" ? "normal" : "all"),
  };
}
