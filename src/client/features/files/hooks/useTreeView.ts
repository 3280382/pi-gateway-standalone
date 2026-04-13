/**
 * useTreeView - 树形视图数据获取 Hook
 *
 * 职责：为TreeView组件提供树形数据
 */

import { useCallback, useEffect, useState } from "react";
import * as fileApi from "@/features/files/services/api/fileApi";
import type { TreeNode } from "@/features/files/types";

export interface UseTreeViewResult {
  treeData: TreeNode[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTreeView(workingDir: string): UseTreeViewResult {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fileApi.tree(workingDir);
      setTreeData(response.items);
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
