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

  // currentBrowsePath: 当前浏览的目录（在文件浏览器中导航不改变全局 workingDir）
  const { currentBrowsePath, setItems, setCurrentBrowsePath, setParentPath, setLoading, setError } =
    useFileStore();
  
  const { workingDir, setFileBrowsePath } = useWorkspaceStore();

  const lastLoadedPathRef = useRef<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化：如果没有设置 currentBrowsePath，则使用 workingDir
  useEffect(() => {
    if (!isActive) return;
    
    // 如果 currentBrowsePath 为空或初始值，使用 workingDir
    if (!currentBrowsePath || currentBrowsePath === "/") {
      const path = workingDir || "/root";
      setCurrentBrowsePath(path);
      setFileBrowsePath(path);
    }
    setIsInitialized(true);
  }, [isActive, workingDir, currentBrowsePath, setCurrentBrowsePath, setFileBrowsePath]);

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
    if (!isActive || !isInitialized || !currentBrowsePath) {
      return;
    }
    // 只有当路径真正改变时才加载
    if (currentBrowsePath !== lastLoadedPathRef.current) {
      loadDirectory(currentBrowsePath);
    }
  }, [isActive, isInitialized, currentBrowsePath, loadDirectory]);

  return {
    loadDirectory,
    refresh,
  };
}
