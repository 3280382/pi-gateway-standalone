/**
 * useFileBrowser - files浏览器核心逻辑 Hook
 *
 * Responsibilities:管理files浏览器的业务逻辑
 * - directories加载（仅在激活状态时）
 * - 错误处理
 * - 与 store 和 service 协调
 *
 * 注意：使用 currentBrowsePath 进行directories浏览，不改变全局 workingDir
 */

// ===== [ANCHOR:IMPORTS] =====

import { useCallback, useEffect, useRef, useState } from "react";
import * as fileOperationsApi from "@/features/files/services/api/fileOperationsApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

// ===== [ANCHOR:TYPES] =====

export interface UseFileBrowserOptions {
  /** 是否处于激活状态 - 非激活时不加载数据 */
  isActive?: boolean;
}

export interface UseFileBrowserResult {
  loadDirectory: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ===== [ANCHOR:HOOK] =====

export function useFileBrowser(options: UseFileBrowserOptions = {}): UseFileBrowserResult {
  const { isActive = true } = options;

  // currentBrowsePath: 当前浏览的directories（在files浏览器中导航不改变全局 workingDir）
  const { currentBrowsePath, setItems, setCurrentBrowsePath, setParentPath, setLoading, setError } =
    useFileStore();

  const { workingDir } = useWorkspaceStore();

  const lastLoadedPathRef = useRef<string>("");
  const isInitializedRef = useRef(false);

  // Initialize：如果 FileStore 的 currentBrowsePath 为空，使用 workingDir
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isActive || isInitializedRef.current) return;

    // 如果 FileStore 的 currentBrowsePath 为空，使用 workingDir
    if (!currentBrowsePath || currentBrowsePath === "/") {
      const path = workingDir || "/root";
      setCurrentBrowsePath(path);
    }
    isInitializedRef.current = true;
  }, [isActive]); // 只在 isActive 变化时执行一次

  /**
   * 加载directories内容
   */
  const loadDirectory = useCallback(
    async (path: string) => {
      // 防止重复加载相同路径
      if (path === lastLoadedPathRef.current) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fileOperationsApi.loadDirectoryContent(path);
        lastLoadedPathRef.current = path;
        setItems(data.items);
        setParentPath(data.parentPath);
      } catch (err) {
        const friendlyMessage = fileOperationsApi.getFriendlyErrorMessage(err, path);
        setError(friendlyMessage);
      } finally {
        setLoading(false);
      }
    },
    [setItems, setParentPath, setLoading, setError]
  );

  /**
   * 刷新当前directories
   */
  const refresh = useCallback(async () => {
    lastLoadedPathRef.current = "";
    await loadDirectory(currentBrowsePath);
  }, [currentBrowsePath, loadDirectory]);

  /**
   * 路径变化时自动加载
   * 仅在激活状态下执行
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isActive || !currentBrowsePath) {
      return;
    }
    // 只有当路径真正改变时才加载
    if (currentBrowsePath !== lastLoadedPathRef.current) {
      loadDirectory(currentBrowsePath);
    }
  }, [isActive, currentBrowsePath]);

  return {
    loadDirectory,
    refresh,
  };
}
