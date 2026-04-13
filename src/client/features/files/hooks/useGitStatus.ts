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
import * as gitApi from "@/features/files/services/api/gitApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { fileBrowserDebug } from "@/lib/debug";

// ===== [ANCHOR:TYPES] =====

export interface UseGitStatusOptions {
  /** 是否处于激活状态 - 非激活时不获取数据 */
  isActive?: boolean;
  /** 当前浏览路径 - 用于获取正确的 git 状态 */
  currentBrowsePath?: string;
}

// ===== [ANCHOR:HOOK] =====

export function useGitStatus(options: UseGitStatusOptions = {}) {
  const { isActive = true, currentBrowsePath } = options;

  const { isGitModeActive, items, updateFileGitStatuses } = useFileStore();
  const { workingDir: globalWorkingDir } = useWorkspaceStore();
  
  // 使用当前浏览路径优先，回退到全局 workingDir
  const workingDir = currentBrowsePath || globalWorkingDir;

  const lastFetchedPathRef = useRef<string>("");
  const itemsLengthRef = useRef<number>(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // 非激活状态不执行任何操作
    if (!isActive) return;

    // Git模式关闭时，清空状态并重置 ref
    if (!isGitModeActive) {
      const hasGitStatus = items.some((item) => item.gitStatus);
      if (hasGitStatus) {
        updateFileGitStatuses({});
      }
      // 重置 ref，这样下次打开 Git 模式时会重新获取
      lastFetchedPathRef.current = "";
      itemsLengthRef.current = 0;
      return;
    }

    // 无文件项时不执行操作
    if (items.length === 0) return;

    // 检查是否需要获取git状态
    const shouldFetchGitStatus =
      workingDir !== lastFetchedPathRef.current ||
      items.length !== itemsLengthRef.current ||
      isInitialMount.current;
    
    fileBrowserDebug.debug("Git状态检查", {
      workingDir,
      lastFetched: lastFetchedPathRef.current,
      shouldFetch: shouldFetchGitStatus,
      isGitModeActive: isGitModeActive,
      itemCount: items.length
    });

    if (!shouldFetchGitStatus) return;

    const fetchGitStatus = async () => {
      fileBrowserDebug.debug("获取Git状态", { workingDir });

      try {
        const statuses = await gitApi.status(workingDir);

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
