/**
 * useFileBrowser - 文件浏览器核心逻辑 Hook
 *
 * 职责：管理文件浏览器的业务逻辑
 * - 目录加载（仅在激活状态时）
 * - 错误处理
 * - 与 store 和 service 协调
 */

// ===== [ANCHOR:IMPORTS] =====

import { useCallback, useEffect, useRef } from "react";
import {
  getFriendlyErrorMessage,
  loadDirectoryContent,
} from "@/features/files/services/api/fileOperationsApi";
import { initializeFilePath } from "@/features/files/services/initialization";
import { useFileStore } from "@/features/files/stores/fileStore";

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

  const { workingDir, setItems, setWorkingDir, setParentPath, setLoading, setError } =
    useFileStore();

  const lastLoadedPathRef = useRef<string>("");
  const isInitializedRef = useRef<boolean>(false);

  /**
   * 初始化文件浏览器路径（只运行一次）
   * 仅在激活状态下执行
   */
  useEffect(() => {
    if (!isActive || isInitializedRef.current) return;

    const init = async () => {
      const path = await initializeFilePath();
      isInitializedRef.current = true;
      setWorkingDir(path);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, setWorkingDir]);

  /**
   * 加载目录内容
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
        const data = await loadDirectoryContent(path);
        lastLoadedPathRef.current = path;
        setItems(data.items);
        setParentPath(data.parentPath);
      } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err, path);
        setError(friendlyMessage);
      } finally {
        setLoading(false);
      }
    },
    [setItems, setParentPath, setLoading, setError]
  );

  /**
   * 刷新当前目录
   */
  const refresh = useCallback(async () => {
    lastLoadedPathRef.current = "";
    await loadDirectory(workingDir);
  }, [workingDir, loadDirectory]);

  /**
   * 路径变化时自动加载
   * 仅在激活状态下执行
   */
  useEffect(() => {
    if (!isActive || workingDir === lastLoadedPathRef.current) {
      return;
    }
    loadDirectory(workingDir);
  }, [isActive, workingDir, loadDirectory]);

  return {
    loadDirectory,
    refresh,
  };
}
