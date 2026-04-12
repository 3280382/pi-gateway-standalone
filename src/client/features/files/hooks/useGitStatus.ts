/**
 * useGitStatus - Git状态管理Hook
 *
 * 职责：管理文件项的Git状态显示
 * - 当Git模式激活且组件激活时，获取当前目录文件的Git状态
 * - 将Git状态映射到store中的文件项
 * - 处理路径映射（相对路径 vs 绝对路径）
 */

// ===== [ANCHOR:IMPORTS] =====

import { useEffect, useRef } from "react";
import { status } from "@/features/files/services/api/gitApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { fileBrowserDebug } from "@/lib/debug";

// ===== [ANCHOR:TYPES] =====

export interface UseGitStatusOptions {
  /** 是否处于激活状态 - 非激活时不获取数据 */
  isActive?: boolean;
}

// ===== [ANCHOR:HOOK] =====

export function useGitStatus(options: UseGitStatusOptions = {}) {
  const { isActive = true } = options;

  const { isGitModeActive, workingDir, items, updateFileGitStatuses } = useFileStore();

  const lastFetchedPathRef = useRef<string>("");
  const itemsLengthRef = useRef<number>(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // 非激活状态不执行任何操作
    if (!isActive) return;

    // Git模式关闭时，清空所有文件的git状态
    if (!isGitModeActive) {
      const hasGitStatus = items.some((item) => item.gitStatus);
      if (hasGitStatus) {
        updateFileGitStatuses({});
      }
      lastFetchedPathRef.current = "";
      itemsLengthRef.current = 0;
      isInitialMount.current = true;
      return;
    }

    // Git模式激活但无文件项，不执行操作
    if (items.length === 0) return;

    // 检查是否需要获取git状态
    const shouldFetchGitStatus =
      workingDir !== lastFetchedPathRef.current ||
      items.length !== itemsLengthRef.current ||
      isInitialMount.current;

    if (!shouldFetchGitStatus) return;

    const fetchGitStatus = async () => {
      fileBrowserDebug.debug("获取Git状态", { workingDir });

      try {
        const statuses = await status(workingDir);

        // 将状态映射转换为与文件项路径匹配的格式
        const itemStatusMap: Record<string, string> = {};

        for (const item of items) {
          if (item.name === "..") continue;

          let matchedStatus: string | undefined;
          let relativePath = item.path;

          if (item.path.startsWith(workingDir)) {
            relativePath = item.path.substring(workingDir.length);
            if (relativePath.startsWith("/")) {
              relativePath = relativePath.substring(1);
            }
          }

          // 尝试相对路径匹配
          if (relativePath && statuses[relativePath]) {
            matchedStatus = statuses[relativePath];
          }
          // 尝试文件名匹配
          else if (statuses[item.name]) {
            matchedStatus = statuses[item.name];
          }
          // 尝试路径后缀匹配
          else {
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
            itemStatusMap[item.path] = matchedStatus;
          }
        }

        updateFileGitStatuses(itemStatusMap);
        lastFetchedPathRef.current = workingDir;
        itemsLengthRef.current = items.length;
        isInitialMount.current = false;
      } catch (error) {
        fileBrowserDebug.error("获取Git状态失败", {
          workingDir,
          error: error instanceof Error ? error.message : String(error),
        });
        updateFileGitStatuses({});
        lastFetchedPathRef.current = "";
        itemsLengthRef.current = 0;
      }
    };

    fetchGitStatus();
  }, [isActive, isGitModeActive, workingDir, items, updateFileGitStatuses]);
}
