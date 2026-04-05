/**
 * Sidebar Store - Zustand State Management
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type {
	FontSize,
	Session,
	SidebarState,
	Theme,
} from "@/features/chat/types/sidebar";

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = (): Omit<SidebarState, keyof SidebarActions> => ({
	workingDir: null,
	recentWorkspaces: [],
	sessions: [],
	theme: "dark",
	fontSize: "medium",
	isLoading: false,
	error: null,
	selectedSessionId: null,
	// 按工作目录保存最后选中的 session
	lastSessionByDir: {} as Record<string, string>,
});

// ============================================================================
// Actions Interface
// ============================================================================

interface SidebarActions {
	// Data Actions
	setWorkingDir: (path: string) => void;
	setRecentWorkspaces: (workspaces: string[]) => void;
	addRecentWorkspace: (path: string) => void;
	removeRecentWorkspace: (path: string) => void;
	setSessions: (sessions: Session[]) => void;

	// Settings Actions
	setTheme: (theme: Theme) => void;
	setFontSize: (size: FontSize) => void;

	// UI Actions
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	selectSession: (id: string | null) => void;
	clearError: () => void;

	// Reset
	reset: () => void;
}

// ============================================================================
// Store Creation
// ============================================================================

export const useSidebarStore = create<SidebarState & SidebarActions>()(
	devtools(
		persist(
			(set, get) => ({
				...createInitialState(),

				// Data Actions
				setWorkingDir: (path: string) => {
					const displayName = path.split("/").pop() || path;
					set({ workingDir: { path, displayName } }, false, "setWorkingDir");
				},

				setRecentWorkspaces: (workspaces: string[]) => {
					set({ recentWorkspaces: workspaces }, false, "setRecentWorkspaces");
				},

				addRecentWorkspace: (path: string) => {
					const current = get().recentWorkspaces;
					// Normalize path (remove trailing slash)
					const normalizedPath = path.replace(/\/$/, "");
					// Remove if exists, add to front, limit to 5
					const filtered = current.filter((w) => w !== normalizedPath);
					const updated = [normalizedPath, ...filtered].slice(0, 5);
					set({ recentWorkspaces: updated }, false, "addRecentWorkspace");
				},

				removeRecentWorkspace: (path: string) => {
					const current = get().recentWorkspaces;
					set(
						{ recentWorkspaces: current.filter((w) => w !== path) },
						false,
						"removeRecentWorkspace",
					);
				},

				setSessions: (sessions: Session[]) => {
					set({ sessions }, false, "setSessions");
				},

				// Settings Actions
				setTheme: (theme: Theme) => {
					set({ theme }, false, "setTheme");
				},

				setFontSize: (size: FontSize) => {
					set({ fontSize: size }, false, "setFontSize");
				},

				// UI Actions
				setLoading: (loading: boolean) => {
					set({ isLoading: loading }, false, "setLoading");
				},

				setError: (error: string | null) => {
					set({ error }, false, "setError");
				},

				selectSession: (id: string | null) => {
					const currentDir = get().workingDir?.path;
					const lastSessionByDir = { ...get().lastSessionByDir };

					// 如果有当前目录，保存 session 到对应目录
					if (currentDir && id) {
						lastSessionByDir[currentDir] = id;
					}

					set(
						{
							selectedSessionId: id,
							lastSessionByDir,
						},
						false,
						"selectSession",
					);
				},

				clearError: () => {
					set({ error: null }, false, "clearError");
				},

				// Reset
				reset: () => {
					set(createInitialState(), false, "reset");
				},
			}),
			{
				name: "sidebar-storage",
				version: 1,
				partialize: (state) => ({
					theme: state.theme,
					fontSize: state.fontSize,
					recentWorkspaces: state.recentWorkspaces,
					lastSessionByDir: state.lastSessionByDir,
				}),
			},
		),
		{ name: "SidebarStore" },
	),
);

// ============================================================================
// Selectors (for performance)
// ============================================================================

export const selectWorkingDir = (state: SidebarState) => state.workingDir;
export const selectRecentWorkspaces = (state: SidebarState) =>
	state.recentWorkspaces;
export const selectSessions = (state: SidebarState) => state.sessions;
export const selectSelectedSessionId = (state: SidebarState) =>
	state.selectedSessionId;
export const selectTheme = (state: SidebarState) => state.theme;
export const selectFontSize = (state: SidebarState) => state.fontSize;
export const selectIsLoading = (state: SidebarState) => state.isLoading;
export const selectError = (state: SidebarState) => state.error;
