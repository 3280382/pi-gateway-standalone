/**
 * Initialization Service - files功能初始化
 *
 * Responsibilities:处理files功能的初始化逻辑
 *
 * 注意：工作directories现在由全局 workspaceStore 统一管理
 * currentBrowsePath 由 FileStore 管理并持久化到 pi:files:browser
 */

import { useFileStore } from "@/features/files/stores";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * 获取初始工作directories（同步版本，用于 SSR 兼容）
 */
export function getInitialPath(): string {
  if (typeof window === "undefined") return "/root";
  return useWorkspaceStore.getState().currentPath;
}

/**
 * 获取当前浏览路径（用于files浏览器显示）
 */
export function getCurrentBrowsePath(): string {
  return useFileStore.getState().currentBrowsePath;
}

/**
 * 设置当前浏览路径（在files浏览器中导航，不改变全局工作directories）
 */
export function setBrowsePath(path: string): void {
  useFileStore.getState().setCurrentBrowsePath(path);
}
