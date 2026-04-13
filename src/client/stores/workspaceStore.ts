/**
 * Workspace Store - 全局工作区状态管理
 * 
 * 职责：
 * - 统一管理当前工作目录（Chat 和 File 共用）
 * - 影响 Chat 的 session 文件选择
 * - 影响 File 的 todo 根目录
 * - 持久化到 localStorage
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface WorkspaceState {
  // 当前工作目录（项目根目录）
  workingDir: string;
  
  // File 浏览器当前浏览路径（相对于 workingDir 的浏览位置）
  fileBrowsePath: string;
}

export interface WorkspaceActions {
  setWorkingDir: (path: string) => void;
  setFileBrowsePath: (path: string) => void;
  // 获取完整浏览路径
  getFullBrowsePath: () => string;
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        workingDir: "/root",
        fileBrowsePath: "/root",

        // 设置工作目录
        setWorkingDir: (workingDir) => set({ 
          workingDir,
          // 切换工作目录时，浏览路径也重置到根
          fileBrowsePath: workingDir 
        }),

        // 设置文件浏览路径（在 file 中导航不改变 workingDir）
        setFileBrowsePath: (fileBrowsePath) => set({ fileBrowsePath }),

        // 获取完整浏览路径
        getFullBrowsePath: () => {
          const { fileBrowsePath } = get();
          return fileBrowsePath;
        },
      }),
      {
        name: "workspace-store",
        version: 1,
        partialize: (state) => ({
          workingDir: state.workingDir,
          fileBrowsePath: state.fileBrowsePath,
        }),
      }
    ),
    { name: "WorkspaceStore" }
  )
);
