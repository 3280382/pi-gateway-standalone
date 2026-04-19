/**
 * useTreeGitStatus - TreeView 专用 Git 状态管理 Hook
 *
 * Responsibilities:为 TreeView Group件管理整棵树的 Git 状态
 * - 当 Git 模式激活且 TreeView 激活时，获取整棵树的 Git 状态
 * - 将 Git 状态映射到树中的所有files节点
 * - 相比 useGitStatus，这个 hook 获取的是整棵树而不仅仅是当前directories
 */

import { useEffect, useRef } from "react";
import * as gitApi from "@/features/files/services/api/gitApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import type { TreeNode } from "@/features/files/types";

export interface UseTreeGitStatusOptions {
  /** 是否处于激活状态 */
  isActive?: boolean;
  /** 树数据 */
  treeData: TreeNode[];
  /** 工作directories */
  workingDir: string;
}

/**
 * 从树节点中提取所有files路径
 */
function extractAllPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];

  function traverse(node: TreeNode) {
    paths.push(node.path);
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return paths;
}

export function useTreeGitStatus(options: UseTreeGitStatusOptions) {
  const { isActive = true, treeData, workingDir } = options;

  const { isGitModeActive, setTreeGitStatusMap } = useFileStore();

  const lastFetchedDirRef = useRef<string>("");
  const treeDataLengthRef = useRef<number>(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // 非激活状态不执行
    if (!isActive) return;

    // Git 模式Close时，Clear状态
    if (!isGitModeActive) {
      setTreeGitStatusMap(new Map());
      lastFetchedDirRef.current = "";
      treeDataLengthRef.current = 0;
      return;
    }

    // 无树数据时不执行
    if (treeData.length === 0) return;

    // 检查是否需要获取 Git 状态
    const shouldFetchGitStatus =
      workingDir !== lastFetchedDirRef.current ||
      treeData.length !== treeDataLengthRef.current ||
      isInitialMount.current;

    if (!shouldFetchGitStatus) return;

    const fetchGitStatus = async () => {
      console.log("[useTreeGitStatus] Fetching Git status for tree:", workingDir);

      try {
        // 获取整棵树的 Git 状态
        const statuses = await gitApi.status(workingDir);

        // 构建路径到状态的映射
        const statusMap = new Map<string, string>();
        const allPaths = extractAllPaths(treeData);

        for (const path of allPaths) {
          // 计算相对路径
          let relativePath = path;
          if (path.startsWith(workingDir)) {
            relativePath = path.substring(workingDir.length);
            if (relativePath.startsWith("/")) {
              relativePath = relativePath.substring(1);
            }
          }

          // 尝试多种匹配方式
          let matchedStatus: string | undefined;

          // 1. 尝试相对路径匹配
          if (relativePath && statuses[relativePath]) {
            matchedStatus = statuses[relativePath];
          }
          // 2. 尝试files名匹配
          else {
            const fileName = path.split("/").pop();
            if (fileName && statuses[fileName]) {
              matchedStatus = statuses[fileName];
            }
          }
          // 3. 尝试路径后缀匹配
          if (!matchedStatus) {
            for (const [statusPath, status] of Object.entries(statuses)) {
              if (
                statusPath === relativePath ||
                statusPath.endsWith(`/${relativePath}`) ||
                (statusPath.endsWith(relativePath) &&
                  statusPath[statusPath.length - relativePath.length - 1] === "/")
              ) {
                matchedStatus = status;
                break;
              }
            }
          }

          if (matchedStatus) {
            statusMap.set(path, matchedStatus);
          }
        }

        setTreeGitStatusMap(statusMap);
        lastFetchedDirRef.current = workingDir;
        treeDataLengthRef.current = treeData.length;
        isInitialMount.current = false;

        console.log(
          `[useTreeGitStatus] Git status fetched: ${statusMap.size} files with status out of ${allPaths.length} total`
        );
      } catch (error) {
        console.error("[useTreeGitStatus] Failed to fetch Git status:", error);
        setTreeGitStatusMap(new Map());
        lastFetchedDirRef.current = "";
        treeDataLengthRef.current = 0;
      }
    };

    fetchGitStatus();
  }, [isActive, isGitModeActive, workingDir, treeData, setTreeGitStatusMap]);
}
