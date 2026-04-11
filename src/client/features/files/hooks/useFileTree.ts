/**
 * useFileTree - 文件树逻辑 Hook
 *
 * 职责：管理文件侧边栏的目录树逻辑
 */

import { useCallback, useEffect, useState } from "react";
import { browseDirectory } from "@/features/files/services/api/fileApi";
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
   * 加载单个目录节点
   */
  const loadDirectoryNode = useCallback(async (path: string): Promise<TreeNode> => {
    fileSidebarDebug.info("加载目录", { path });

    try {
      const data = await browseDirectory(path);

      // 只保留子目录路径
      const childDirs = data.items.filter((item) => item.isDirectory).map((item) => item.path);

      const node: TreeNode = {
        name: data.workingDir.split("/").pop() || "/",
        path: data.workingDir,
        isDirectory: true,
        children: [],
        childPaths: childDirs,
        loaded: false,
        expanded: false,
      };

      fileSidebarDebug.info("目录节点创建", {
        path,
        name: node.name,
        childCount: childDirs.length,
      });

      return node;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "加载失败";
      fileSidebarDebug.error("目录加载失败", { path, error: errorMsg });
      throw err;
    }
  }, []);

  /**
   * 加载根目录
   */
  const loadRoot = useCallback(async () => {
    fileSidebarDebug.info("加载根目录树");
    setLoading(true);
    setError(null);

    try {
      const rootNode = await loadDirectoryNode("/root");
      setTree([rootNode]);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "根目录加载失败";
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
   * 加载节点的子目录
   */
  const loadNodeChildren = useCallback(
    async (node: TreeNode) => {
      if (!node.isDirectory || node.loaded || node.loading) return;

      fileSidebarDebug.info("加载子目录", { path: node.path });

      // 标记为加载中
      setTree((prev) => updateNodeInTree(node.path, (n) => ({ ...n, loading: true })));

      try {
        // 并行加载所有子目录
        const childNodes = await Promise.all(
          node.childPaths.map((childPath) =>
            loadDirectoryNode(childPath).catch((err) => {
              fileSidebarDebug.error("加载子目录失败", {
                path: childPath,
                error: err instanceof Error ? err.message : String(err),
              });
              return null;
            })
          )
        );

        // 过滤掉加载失败的
        const validChildren = childNodes.filter((child): child is TreeNode => child !== null);

        // 更新节点
        setTree((prev) =>
          updateNodeInTree(node.path, (n) => ({
            ...n,
            children: validChildren,
            loaded: true,
            loading: false,
            expanded: true,
          }))
        );

        fileSidebarDebug.info("子目录加载完成", {
          path: node.path,
          childCount: validChildren.length,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "加载失败";
        setTree((prev) =>
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
   * 切换节点展开/折叠
   */
  const toggleNode = useCallback(
    (node: TreeNode) => {
      fileSidebarDebug.debug("切换节点展开状态", {
        path: node.path,
        currentExpanded: node.expanded,
      });

      // 如果已加载，直接切换展开状态
      if (node.loaded) {
        setTree((prev) =>
          updateNodeInTree(node.path, (n) => ({
            ...n,
            expanded: !n.expanded,
          }))
        );
      }
      // 否则加载子目录（loadNodeChildren 会处理展开）
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
