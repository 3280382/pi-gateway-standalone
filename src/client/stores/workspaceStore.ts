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
import { APP_STORAGE_KEYS, APP_STORAGE_VERSION, APP_WORKSPACE_PERSIST } from "./persist.config";

// 延迟导入以避免循环依赖
let sidebarStore: typeof import("@/features/chat/stores/sidebarStore") | null = null;
let sessionStore: typeof import("@/features/chat/stores/sessionStore") | null = null;

function getSidebarStore() {
  if (!sidebarStore) {
    sidebarStore = require("@/features/chat/stores/sidebarStore");
  }
  return sidebarStore;
}

function getSessionStore() {
  if (!sessionStore) {
    sessionStore = require("@/features/chat/stores/sessionStore");
  }
  return sessionStore;
}

export interface WorkspaceState {
  // 当前工作目录（项目根目录）
  workingDir: string;

  // File 浏览器当前浏览路径（相对于 workingDir 的浏览位置）
  fileBrowsePath: string;

  // 文件浏览器最后浏览位置（持久化，下次打开时恢复）
  currentBrowsePath: string;
}

export interface WorkspaceActions {
  setWorkingDir: (path: string) => void;
  setFileBrowsePath: (path: string) => void;
  setCurrentBrowsePath: (path: string) => void;
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
        currentBrowsePath: "/root",

        // 设置工作目录（同时同步到 sidebarStore 和 sessionStore）
        setWorkingDir: (workingDir) => {
          // 同步更新 sidebarStore 的 workingDir（包含 path 和 displayName 的对象）
          try {
            const { useSidebarStore } = getSidebarStore();
            const sidebarState = useSidebarStore.getState();
            if (sidebarState && sidebarState.workingDir?.path !== workingDir) {
              const displayName = workingDir.split("/").pop() || workingDir;
              useSidebarStore.setState(
                {
                  workingDir: { path: workingDir, displayName },
                },
                false,
                "workspaceStore/syncWorkingDir"
              );
            }
          } catch (e) {
            // sidebarStore 可能尚未初始化，忽略错误
          }

          // 同步更新 sessionStore 的 workingDir（字符串）
          try {
            const { useSessionStore } = getSessionStore();
            const sessionState = useSessionStore.getState();
            if (sessionState && sessionState.workingDir !== workingDir) {
              useSessionStore.setState(
                {
                  workingDir,
                },
                false,
                "workspaceStore/syncWorkingDir"
              );
            }
          } catch (e) {
            // sessionStore 可能尚未初始化，忽略错误
          }

          set({
            workingDir,
            // 切换工作目录时，浏览路径也重置到根
            fileBrowsePath: workingDir,
            currentBrowsePath: workingDir,
          });
        },

        // 设置文件浏览路径（在 file 中导航不改变 workingDir）
        setFileBrowsePath: (fileBrowsePath) => set({ fileBrowsePath }),

        // 设置当前浏览路径（持久化）
        setCurrentBrowsePath: (currentBrowsePath) => set({ currentBrowsePath }),

        // 获取完整浏览路径
        getFullBrowsePath: () => {
          const { fileBrowsePath } = get();
          return fileBrowsePath;
        },
      }),
      {
        name: APP_STORAGE_KEYS.APP_WORKSPACE,
        version: APP_STORAGE_VERSION.APP_WORKSPACE,
        partialize: (state) =>
          Object.fromEntries(APP_WORKSPACE_PERSIST.map((key) => [key, state[key]])),
      }
    ),
    { name: "WorkspaceStore" }
  )
);
