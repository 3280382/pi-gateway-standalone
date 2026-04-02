/**
 * Sidebar Store - Zustand State Management
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type {
	FontSize,
	SearchFilters,
	Session,
	SidebarState,
	Theme,
} from "@/types/sidebar";

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = (): Omit<SidebarState, keyof SidebarActions> => ({
	workingDir: null,
	recentWorkspaces: [],
	sessions: [],
	searchQuery: "",
	searchFilters: {
		user: true,
		assistant: true,
		thinking: true,
		tools: true,
	},
	theme: "dark",
	fontSize: "medium",
	isLoading: false,
	error: null,
	selectedSessionId: null,
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

	// Search Actions
	setSearchQuery: (query: string) => void;
	setSearchFilters: (filters: Partial<SearchFilters>) => void;

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

				// Search Actions
				setSearchQuery: (query: string) => {
					console.log("[SidebarStore] setSearchQuery:", query);
					set({ searchQuery: query }, false, "setSearchQuery");
				},

				setSearchFilters: (filters: Partial<SearchFilters>) => {
					set(
						(state) => ({
							searchFilters: { ...state.searchFilters, ...filters },
						}),
						false,
						"setSearchFilters",
					);
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
					set({ selectedSessionId: id }, false, "selectSession");
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
					searchQuery: state.searchQuery,
					fontSize: state.fontSize,
					searchFilters: state.searchFilters,
					recentWorkspaces: state.recentWorkspaces,
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
export const selectSearchQuery = (state: SidebarState) => state.searchQuery;
export const selectSearchFilters = (state: SidebarState) => state.searchFilters;
export const selectTheme = (state: SidebarState) => state.theme;
export const selectFontSize = (state: SidebarState) => state.fontSize;
export const selectIsLoading = (state: SidebarState) => state.isLoading;
export const selectError = (state: SidebarState) => state.error;
