/**
 * useFileBrowser - 文件浏览器核心逻辑 Hook
 *
 * 职责：管理文件浏览器的业务逻辑
 * - 目录加载（仅在激活状态时）
 * - 错误处理
 * - 与 store 和 service 协调
 * 
 * 注意：使用 currentBrowsePath 进行目录浏览，不改变全局 workingDir
 */

// ===== [ANCHOR:IMPORTS] =====

import { useCallback, useEffect, useRef } from "react";
import * as fileOperationsApi from "@/features/files/services/api/fileOperationsApi";
import { initializeFilePath } from "@/features/files/services/initialization";
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

  // currentBrowsePath: 当前浏览的目录（在文件浏览器中导航不改变全局 workingDir）
  const { currentBrowsePath, setItems, setParentPath, setLoading, setError } =
    useFileStore();
  
  const { setFileBrowsePath } = useWorkspaceStore();

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
      // 只更新 fileBrowsePath，不修改 currentBrowsePath
      setFileBrowsePath(path);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  /**
   * 加载目录内容
   * 注意：此函数只加载数据，不更新 currentBrowsePath
   * currentBrowsePath 应由导航操作（如点击文件夹）来更新
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
        // 只更新 fileBrowsePath 用于显示，不更新 currentBrowsePath
        setFileBrowsePath(path);
      } catch (err) {
        const friendlyMessage = fileOperationsApi.getFriendlyErrorMessage(err, path);
        setError(friendlyMessage);
      } finally {
        setLoading(false);
      }
    },
    [setItems, setParentPath, setLoading, setError, setFileBrowsePath]
  );

  /**
   * 刷新当前目录
   */
  const refresh = useCallback(async () => {
    lastLoadedPathRef.current = "";
    await loadDirectory(currentBrowsePath);
  }, [currentBrowsePath, loadDirectory]);

  /**
   * 路径变化时自动加载
   * 仅在激活状态下执行
   */
  useEffect(() => {
    if (!isActive || !currentBrowsePath) {
      return;
    }
    // 只有当路径真正改变时才加载
    if (currentBrowsePath !== lastLoadedPathRef.current) {
      loadDirectory(currentBrowsePath);
    }
  }, [isActive, currentBrowsePath, loadDirectory]);

  return {
    loadDirectory,
    refresh,
  };
}
