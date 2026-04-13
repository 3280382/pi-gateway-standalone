/**
 * useFileNavigation - 文件导航逻辑 Hook
 *
 * 职责：管理文件浏览器的导航逻辑
 * - 在文件浏览器中导航（只改变 currentBrowsePath，不改变全局 workingDir）
 */

import { useCallback } from "react";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export interface UseFileNavigationResult {
  navigateTo: (path: string) => void;
  navigateUp: () => void;
  navigateHome: () => void;
  canNavigateUp: boolean;
}

export function useFileNavigation(): UseFileNavigationResult {
  // currentBrowsePath: 当前浏览路径（在文件浏览器中导航不改变全局 workingDir）
  const { currentBrowsePath, parentPath, setCurrentBrowsePath } = useFileStore();
  // workingDir: 全局工作目录（项目根目录）
  const { workingDir, setFileBrowsePath } = useWorkspaceStore();

  /**
   * 导航到指定路径
   */
  const navigateTo = useCallback(
    (path: string) => {
      if (path !== currentBrowsePath) {
        setCurrentBrowsePath(path);
        setFileBrowsePath(path);
      }
    },
    [currentBrowsePath, setCurrentBrowsePath, setFileBrowsePath]
  );

  /**
   * 向上导航
   */
  const navigateUp = useCallback(() => {
    if (currentBrowsePath === "/" || currentBrowsePath === "") return;

    const parent = parentPath || currentBrowsePath.split("/").slice(0, -1).join("/") || "/";
    if (parent !== currentBrowsePath) {
      setCurrentBrowsePath(parent);
      setFileBrowsePath(parent);
    }
  }, [currentBrowsePath, parentPath, setCurrentBrowsePath, setFileBrowsePath]);

  /**
   * 导航到主页（全局工作目录）
   */
  const navigateHome = useCallback(() => {
    setCurrentBrowsePath(workingDir);
    setFileBrowsePath(workingDir);
  }, [workingDir, setCurrentBrowsePath, setFileBrowsePath]);

  /**
   * 是否可以向上导航
   */
  const canNavigateUp = currentBrowsePath !== "/" && currentBrowsePath !== "";

  return {
    navigateTo,
    navigateUp,
    navigateHome,
    canNavigateUp,
  };
}
