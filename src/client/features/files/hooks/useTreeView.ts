/**
 * useTreeView - 树形视图数据获取 Hook
 *
 * 职责：为TreeView组件提供树形数据
 * 使用store中的items（包含gitStatus）并转换为树形结构
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import * as fileApi from "@/features/files/services/api/fileApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import type { TreeNode } from "@/features/files/types";

export interface UseTreeViewResult {
  treeData: TreeNode[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTreeView(workingDir: string): UseTreeViewResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { items } = useFileStore();

  // 将items转换为TreeNode格式（扁平化树结构）
  const treeData = useMemo(() => {
    const result: TreeNode[] = [];
    
    const flatten = (
      nodeItems: typeof items,
      depth: number = 0,
      parentLastStack: boolean[] = []
    ) => {
      nodeItems.forEach((item, index) => {
        const isLast = index === nodeItems.length - 1;
        
        result.push({
          name: item.name,
          path: item.path,
          isDirectory: item.isDirectory,
          gitStatus: item.gitStatus,
          level: depth,
          isLast,
          parentLastStack: [...parentLastStack],
        });
      });
    };

    flatten(items);
    return result;
  }, [items]);

  const refresh = useCallback(async () => {
    // items通过useFileStore自动更新，这里只触发重新加载
    setIsLoading(true);
    setError(null);

    try {
      // 调用tree API确保数据是最新的
      await fileApi.tree(workingDir);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load tree";
      setError(errorMsg);
      console.error("[useTreeView] Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workingDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    treeData,
    isLoading,
    error,
    refresh,
  };
}
