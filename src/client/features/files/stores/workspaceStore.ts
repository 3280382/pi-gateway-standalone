/**
 * Workspace Store - Files Feature 工作区状态管理
 * 管理工作目录和最近访问的工作区
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

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
				name: "files:workspace",
				partialize: (state) => ({
					recentWorkspaces: state.recentWorkspaces,
				}),
			},
		),
		{ name: "WorkspaceStore" },
	),
);
