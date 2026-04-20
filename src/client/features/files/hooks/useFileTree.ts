/**
 * useFileTree - files树逻辑 Hook
 *
 * Responsibilities:管理filesSidebar的directories树逻辑
 */

import { useCallback, useEffect, useState } from "react";
import * as fileApi from "@/features/files/services/api/fileApi";
import { fileSidebarDebug } from "@/lib/debug";

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  childPaths: string[];
  loaded: boolean;
  loading?: boolean;
  error?: string;
  expanded?: boolean;
}

export interface UseFileTreeResult {
  tree: TreeNode[];
  loading: boolean;
  error: string | null;
  loadRoot: () => Promise<void>;
  loadNodeChildren: (node: TreeNode) => Promise<void>;
  toggleNode: (node: TreeNode) => void;
  findNodeByPath: (path: string, nodes?: TreeNode[]) => TreeNode | null;
}

export function useFileTree(): UseFileTreeResult {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载单个directories节点
   */
  const loadDirectoryNode = useCallback(async (path: string): Promise<TreeNode> => {
    fileSidebarDebug.info("加载directories", { path });

    try {
      const data = await fileApi.browse(path);

      // 只保留子directories路径
      const childDirs = data.  items.filter((item) => item.isDirectory).map((item) => item.path);

      const node: TreeNode = {
        name: data.workingDir.split("/").pop() || "/",
        path: data.workingDir,
        isDirectory: true,
        children: [],
        childPaths: childDirs,
        loaded: false,
        expanded: false,
      };

      fileSidebarDebug.info("directories节点创建", {
        path,
        name: node.name,
        childCount: childDirs.length,
      });

      return node;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "加载Failed";
      fileSidebarDebug.error("directories加载Failed", { path, error: errorMsg });
      throw err;
    }
  }, []);

  /**
   * 加载根directories
   */
  const loadRoot = useCallback(async () => {
    fileSidebarDebug.info("加载根directories树");
    setLoading(true);
    setError(null);

    try {
      const rootNode = await loadDirectoryNode("/root");
      setTree([rootNode]);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "根directories加载Failed";
      setError(errorMsg);
      setLoading(false);
    }
  }, [loadDirectoryNode]);

  /**
   * 查找节点
   */
  const findNodeByPath = useCallback(
    (path: string, nodes: TreeNode[] = tree): TreeNode | null => {
      for (const node of nodes) {
        if (node.path === path) return node;
        if (node.children) {
          const found = findNodeByPath(path, node.children);
          if (found) return found;
        }
      }
      return null;
    },
    [tree]
  );

  /**
   * 更新树中的节点
   */
  const updateNodeInTree = useCallback(
    (path: string, updater: (node: TreeNode) => TreeNode): TreeNode[] => {
      const updateRecursive = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => {
          if (node.path === path) {
            return updater(node);
          }
          if (node.children) {
            return { ...node, children: updateRecursive(node.children) };
          }
          return node;
        });
      };
      return updateRecursive(tree);
    },
    [tree]
  );

  /**
   * 加载节点的子directories
   */
  const loadNodeChildren = useCallback(
    async (node: TreeNode) => {
      if (!node.isDirectory || node.loaded || node.loading) return;

      fileSidebarDebug.info("加载子directories", { path: node.path });

      // 标记为Loading
      setTree((_prev) => updateNodeInTree(node.path, (n) => ({ ...n, loading: true })));

      try {
        // 并Rows加载所有子directories
        const childNodes = await Promise.all(
          node.childPaths.map((childPath) =>
            loadDirectoryNode(childPath).catch((err) => {
              fileSidebarDebug.error("加载子directoriesFailed", {
                path: childPath,
                error: err instanceof Error ? err.message : String(err),
              });
              return null;
            })
          )
        );

        // 过滤掉加载Failed的
        const validChildren = childNodes.filter((child): child is TreeNode => child !== null);

        // 更新节点
        setTree((_prev) =>
          updateNodeInTree(node.path, (n) => ({
            ...n,
            children: validChildren,
            loaded: true,
            loading: false,
            expanded: true,
          }))
        );

        fileSidebarDebug.info("子directories加载完成", {
          path: node.path,
          childCount: validChildren.length,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "加载Failed";
        setTree((_prev) =>
          updateNodeInTree(node.path, (n) => ({
            ...n,
            loading: false,
            error: errorMsg,
          }))
        );
      }
    },
    [loadDirectoryNode, updateNodeInTree]
  );

  /**
   * 切换节点Expand/Collapse
   */
  const toggleNode = useCallback(
    (node: TreeNode) => {
      fileSidebarDebug.debug("切换节点Expand状态", {
        path: node.path,
        currentExpanded: node.expanded,
      });

      // 如果已加载，直接切换Expand状态
      if (node.loaded) {
        setTree((_prev) =>
          updateNodeInTree(node.path, (n) => ({
            ...n,
            expanded: !n.expanded,
          }))
        );
      }
      // 否则加载子directories（loadNodeChildren 会处理Expand）
    },
    [updateNodeInTree]
  );

  /**
   * 初始加载
   */
  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  return {
    tree,
    loading,
    error,
    loadRoot,
    loadNodeChildren,
    toggleNode,
    findNodeByPath,
  };
}
