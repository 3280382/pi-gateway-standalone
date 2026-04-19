/**
 * Workspace Store - Global workspace state
 *
 * Responsibilities:
 * - Unified working directory (shared)
 * - Affects Chat session file selection
 * - Affects File todo root directory
 * - Persist to localStorage
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

export interface WorkspaceState {
  // Current working directory (project root)- 这是真正持久化的工作目录
  workingDir: string;
}

export interface WorkspaceActions {
  setWorkingDir: (path: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        workingDir: "/root",

        // Set working directory (sync to stores)
        setWorkingDir: (workingDir) => {
          console.log("[WorkspaceStore] setWorkingDir called:", workingDir);

          // Sync update sidebarStore workingDir（包含 path 和 displayName 的对象）
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
            // sidebarStore may not be initialized
            console.log("[WorkspaceStore] sidebarStore not ready:", e);
          }

          // Sync update sessionStore workingDir
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
            // sessionStore may not be initialized
            console.log("[WorkspaceStore] sessionStore not ready:", e);
          }

          const result = set({ workingDir });
          console.log("[WorkspaceStore] set({ workingDir }) result:", result);
          return result;
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
