/**
 * Workspace Store - Files Feature 工作区状态管理
 * 管理工作目录和最近访问的工作区
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface WorkspaceState {
	// 当前工作目录
	currentDir: string;
	// 最近工作区
	recentWorkspaces: string[];
}

interface WorkspaceActions {
	setCurrentDir: (dir: string) => void;
	addRecentWorkspace: (dir: string) => void;
	removeRecentWorkspace: (dir: string) => void;
	clearRecentWorkspaces: () => void;
}

// 从旧 store 迁移数据（兼容处理）
function migrateFromOldStore(): Partial<WorkspaceState> {
	try {
		const oldData = localStorage.getItem("session-store");
		if (oldData) {
			const parsed = JSON.parse(oldData);
			return {
				currentDir: parsed.state?.currentDir || "/root",
				recentWorkspaces: parsed.state?.recentWorkspaces || [],
			};
		}
	} catch {
		// 忽略解析错误
	}
	return { currentDir: "/root", recentWorkspaces: [] };
}

const migratedState = migrateFromOldStore();

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
	devtools(
		persist(
			(set) => ({
				// 初始状态（优先使用迁移的数据）
				currentDir: migratedState.currentDir || "/root",
				recentWorkspaces: migratedState.recentWorkspaces || [],

				// 设置当前目录
				setCurrentDir: (dir) => set({ currentDir: dir }),

				// 添加最近工作区
				addRecentWorkspace: (dir) =>
					set((state) => {
						const filtered = state.recentWorkspaces.filter((w) => w !== dir);
						return { recentWorkspaces: [dir, ...filtered].slice(0, 10) };
					}),

				// 移除最近工作区
				removeRecentWorkspace: (dir) =>
					set((state) => ({
						recentWorkspaces: state.recentWorkspaces.filter((w) => w !== dir),
					})),

				// 清空最近工作区
				clearRecentWorkspaces: () => set({ recentWorkspaces: [] }),
			}),
			{
				name: "files-workspace-store",
				partialize: (state) => ({
					currentDir: state.currentDir,
					recentWorkspaces: state.recentWorkspaces,
				}),
			},
		),
		{ name: "WorkspaceStore" },
	),
);
