/**
 * Initialization Service - 文件功能初始化
 *
 * 职责：处理文件功能的初始化逻辑
 * 
 * 注意：工作目录现在由全局 workspaceStore 统一管理
 * currentBrowsePath 由 useFileBrowser hook 初始化
 */

import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useFileStore } from "@/features/files/stores";

/**
 * 获取初始路径（同步版本，用于 SSR 兼容）
 */
export function getInitialPath(): string {
  if (typeof window === "undefined") return "/root";
  return useWorkspaceStore.getState().workingDir;
}

/**
 * 获取当前浏览路径（用于文件浏览器显示）
 */
export function getCurrentBrowsePath(): string {
  return useFileStore.getState().currentBrowsePath;
}

/**
 * 设置当前浏览路径（在文件浏览器中导航，不改变全局工作目录）
 */
export function setBrowsePath(path: string): void {
  useFileStore.getState().setCurrentBrowsePath(path);
  useWorkspaceStore.getState().setFileBrowsePath(path);
  useWorkspaceStore.getState().setCurrentBrowsePath(path); // 同步持久化
}
