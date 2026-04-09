/**
 * Workspace Store - Files Feature 工作区状态管理
 * 管理最近访问的工作区
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { FILES_WORKSPACE_PERSIST, FILES_STORAGE_KEYS, FILES_STORAGE_VERSION } from "./persist.config";

export interface WorkspaceState {
	recentWorkspaces: string[];
}

interface WorkspaceActions {
	addRecentWorkspace: (dir: string) => void;
	clearRecentWorkspaces: () => void;
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
	devtools(
		persist(
			(set) => ({
				recentWorkspaces: [],

				addRecentWorkspace: (dir) =>
					set((state) => {
						const filtered = state.recentWorkspaces.filter((w) => w !== dir);
						return { recentWorkspaces: [dir, ...filtered].slice(0, 10) };
					}),

				clearRecentWorkspaces: () => set({ recentWorkspaces: [] }),
			}),
			{
				name: FILES_STORAGE_KEYS.FILES_WORKSPACE,
				version: FILES_STORAGE_VERSION.FILES_WORKSPACE,
				partialize: (state) =>
					Object.fromEntries(
						FILES_WORKSPACE_PERSIST.map((key) => [key, state[key]]),
					),
			},
		),
		{ name: "WorkspaceStore" },
	),
);
