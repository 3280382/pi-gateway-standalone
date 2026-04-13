/**
 * Initialization Service - 文件功能初始化
 *
 * 职责：处理文件功能的初始化逻辑（纯业务逻辑，不直接调用 API）
 * - 路径恢复
 * - 服务器工作目录获取
 *
 * 注意：持久化状态通过 Zustand store 自动管理，不再直接读取 localStorage
 * 工作目录现在由全局 workspaceStore 统一管理
 */

import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useFileStore } from "@/features/files/stores";
import { checkPathExists, getServerWorkingDir } from "./api/fileApi";

/**
 * 初始化文件浏览器路径
 *
 * 流程：
 * 1. 从 workspaceStore 获取已恢复的工作目录（Zustand persist 自动从 localStorage 恢复）
 * 2. 检查路径是否仍然有效
 * 3. 如果无效，使用服务器当前目录
 * 4. 同时设置 fileStore 的 currentBrowsePath
 */
export async function initializeFilePath(): Promise<string> {
  // 从全局 workspaceStore 获取工作目录
  const { workingDir, setFileBrowsePath } = useWorkspaceStore.getState();
  const { setCurrentBrowsePath } = useFileStore.getState();

  // 如果有持久化的路径，检查是否还存在
  if (workingDir && workingDir !== "/root") {
    const exists = await checkPathExists(workingDir);
    if (exists) {
      console.log("[Init] Using persisted working dir:", workingDir);
      // 同步设置浏览路径
      setCurrentBrowsePath(workingDir);
      setFileBrowsePath(workingDir);
      return workingDir;
    }
    console.log("[Init] Persisted path no longer exists:", workingDir);
  }

  // 使用服务器当前目录
  const serverDir = await getServerWorkingDir();
  console.log("[Init] Using server working dir:", serverDir);

  // 更新全局工作目录和浏览路径
  useWorkspaceStore.getState().setWorkingDir(serverDir);
  setFileBrowsePath(serverDir);
  setCurrentBrowsePath(serverDir);

  return serverDir;
}

/**
 * 获取初始路径（同步版本，用于 SSR 兼容）
 *
 * 注意：此函数仅返回 store 中的当前值，不验证路径有效性
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
}
