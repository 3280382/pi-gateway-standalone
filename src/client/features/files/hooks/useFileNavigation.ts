/**
 * useFileNavigation - files导航逻辑 Hook
 *
 * Responsibilities:管理files浏览器的导航逻辑
 * - 在files浏览器中导航（只改变 currentBrowsePath，不改变全局 workingDir）
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
  // currentBrowsePath: 当前浏览路径（在files浏览器中导航不改变全局 workingDir）
  const { currentBrowsePath, parentPath, setCurrentBrowsePath } = useFileStore();
  // workingDir: 全局工作directories（项目根directories）
  const { workingDir } = useWorkspaceStore();

  /**
   * 导航到指定路径
   */
  const navigateTo = useCallback(
    (path: string) => {
      if (path !== currentBrowsePath) {
        setCurrentBrowsePath(path);
      }
    },
    [currentBrowsePath, setCurrentBrowsePath]
  );

  /**
   * 向上导航
   */
  const navigateUp = useCallback(() => {
    if (currentBrowsePath === "/" || currentBrowsePath === "") return;

    const parent = parentPath || currentBrowsePath.split("/").slice(0, -1).join("/") || "/";
    if (parent !== currentBrowsePath) {
      setCurrentBrowsePath(parent);
    }
  }, [currentBrowsePath, parentPath, setCurrentBrowsePath]);

  /**
   * 导航到主Pages（全局工作directories）
   */
  const navigateHome = useCallback(() => {
    setCurrentBrowsePath(workingDir);
  }, [workingDir, setCurrentBrowsePath]);

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
