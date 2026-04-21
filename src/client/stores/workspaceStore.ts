/**
 * Workspace Store - Unified workspace state
 *
 * Responsibilities:
 * - Current workspace path (shared between chat and files)
 * - Recent workspaces list (for sidebar and header dropdown)
 * - Session file mapping per workspace
 * - Chat settings (defaultMessageLimit)
 * - Persist to localStorage as single source of truth
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { APP_STORAGE_KEYS, APP_STORAGE_VERSION, APP_WORKSPACE_PERSIST } from "./persist.config";

// Delay import to avoid circular dependency
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

export interface WorkspaceItem {
  path: string;
  displayName: string;
  /** 该 workspace 最近选择的 session file */
  lastSessionFile?: string;
}

export interface WorkspaceState {
  /** Current workspace path (shared by chat header and files header) */
  currentPath: string;
  /** Recent workspaces (for sidebar and header dropdown, max 3) */
  recentWorkspaces: WorkspaceItem[];
  /** workspacePath -> sessionFile mapping */
  sessionFiles: Record<string, string>;
  /** Default message limit for chat history loading */
  defaultMessageLimit: number;
}

export interface WorkspaceActions {
  setCurrentPath: (path: string, sessionFile?: string) => void;
  setSessionFile: (workspace: string, sessionFile: string) => void;
  getSessionFile: (workspace: string) => string | undefined;
  setDefaultMessageLimit: (limit: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentPath: "/root",
        recentWorkspaces: [],
        sessionFiles: {},
        defaultMessageLimit: 100,

        // Set current workspace path (updates recentWorkspaces and syncs to stores)
        setCurrentPath: (currentPath, sessionFile?: string) => {
          const displayName = currentPath.split("/").pop() || currentPath;

          set((state) => {
            // 保留已有的 lastSessionFile（如果存在）或使用传入的 sessionFile
            const existing = state.recentWorkspaces.find((w) => w.path === currentPath);
            const lastSessionFile = sessionFile ?? existing?.lastSessionFile;
            const newDir: WorkspaceItem = { path: currentPath, displayName, lastSessionFile };

            const filtered = state.recentWorkspaces.filter((w) => w.path !== currentPath);
            const recentWorkspaces = [newDir, ...filtered].slice(0, 3);
            return { currentPath, recentWorkspaces };
          });

          // Sync update sidebarStore workingDir (object containing path and displayName)
          try {
            const { useSidebarStore } = getSidebarStore();
            const sidebarState = useSidebarStore.getState();
            if (sidebarState && sidebarState.workingDir?.path !== currentPath) {
              useSidebarStore.setState(
                { workingDir: { path: currentPath, displayName } },
                false,
                "workspaceStore/syncWorkingDir"
              );
            }
          } catch (e) {
            // sidebarStore may not be initialized
          }

          // Sync update sessionStore workingDir
          try {
            const { useSessionStore } = getSessionStore();
            const sessionState = useSessionStore.getState();
            if (sessionState && sessionState.workingDir !== currentPath) {
              useSessionStore.setState(
                { workingDir: currentPath },
                false,
                "workspaceStore/syncWorkingDir"
              );
            }
          } catch (e) {
            // sessionStore may not be initialized
          }
        },

        setSessionFile: (workspace, sessionFile) =>
          set((state) => {
            // 同时更新 sessionFiles 映射和 recentWorkspaces 中的 lastSessionFile
            const recentWorkspaces = state.recentWorkspaces.map((w) =>
              w.path === workspace ? { ...w, lastSessionFile: sessionFile } : w
            );
            return {
              sessionFiles: { ...state.sessionFiles, [workspace]: sessionFile },
              recentWorkspaces,
            };
          }),

        getSessionFile: (workspace) => get().sessionFiles[workspace],

        setDefaultMessageLimit: (limit) => set({ defaultMessageLimit: limit }),
      }),
      {
        name: APP_STORAGE_KEYS.APP_WORKSPACE,
        version: APP_STORAGE_VERSION.APP_WORKSPACE,
        partialize: (state) =>
          Object.fromEntries(APP_WORKSPACE_PERSIST.map((key) => [key, state[key]])) as Partial<
            WorkspaceState & WorkspaceActions
          >,
      }
    ),
    { name: "WorkspaceStore" }
  )
);
