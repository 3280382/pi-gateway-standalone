/**
 * Mock Sidebar Store - For UI Testing
 */

import { vi } from "vitest";
import type {
	FontSize,
	SearchFilters,
	Session,
	SidebarState,
	Theme,
	WorkingDirectory,
} from "@/types/sidebar";

// ============================================================================
// Mock Data Factories
// ============================================================================

export const createMockWorkingDirectory = (
	overrides?: Partial<WorkingDirectory>,
): WorkingDirectory => ({
	path: "/home/user/project",
	displayName: "project",
	...overrides,
});

export const createMockSession = (
	id: string,
	overrides?: Partial<Session>,
): Session => ({
	id,
	name: `Session ${id}`,
	messageCount: Math.floor(Math.random() * 20) + 1,
	lastModified: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
	firstMessage: `This is the first message of session ${id}`,
	...overrides,
});

export const createMockSearchFilters = (
	overrides?: Partial<SearchFilters>,
): SearchFilters => ({
	user: true,
	assistant: true,
	thinking: true,
	tools: true,
	...overrides,
});

export const createMockSidebarState = (
	overrides?: Partial<SidebarState>,
): SidebarState => ({
	workingDir: createMockWorkingDirectory(),
	recentWorkspaces: [
		"/home/user/project",
		"/home/user/docs",
		"/home/user/experiments",
	],
	sessions: [
		createMockSession("1", { name: "API Integration", messageCount: 15 }),
		createMockSession("2", { name: "Bug Fix Session", messageCount: 8 }),
		createMockSession("3", { name: "Feature Development", messageCount: 23 }),
	],
	searchQuery: "",
	searchFilters: createMockSearchFilters(),
	theme: "dark" as Theme,
	fontSize: "medium" as FontSize,
	isLoading: false,
	error: null,
	selectedSessionId: null,
	...overrides,
});

// ============================================================================
// Mock Store Factory
// ============================================================================

export interface MockSidebarStore {
	getState: () => SidebarState;
	setState: (updates: Partial<SidebarState>) => void;
	subscribe: (callback: (state: SidebarState) => void) => () => void;
	getInitialState: () => SidebarState;
}

export const createMockSidebarStore = (
	initialState?: Partial<SidebarState>,
): MockSidebarStore => {
	let state = createMockSidebarState(initialState);
	const listeners = new Set<(state: SidebarState) => void>();

	return {
		getState: () => state,

		setState: vi.fn((updates: Partial<SidebarState>) => {
			state = { ...state, ...updates };
			for (const listener of listeners) {
				listener(state);
			}
		}),

		subscribe: vi.fn((callback: (state: SidebarState) => void) => {
			listeners.add(callback);
			return () => listeners.delete(callback);
		}),

		getInitialState: () => createMockSidebarState(initialState),
	};
};

// ============================================================================
// Predefined Mock States
// ============================================================================

export const emptyMockState = createMockSidebarState({
	workingDir: null,
	recentWorkspaces: [],
	sessions: [],
});

export const loadingMockState = createMockSidebarState({
	isLoading: true,
});

export const errorMockState = createMockSidebarState({
	error: "Failed to load data from server",
});

export const withSelectedSessionMockState = createMockSidebarState({
	selectedSessionId: "1",
});

export const lightThemeMockState = createMockSidebarState({
	theme: "light",
});
