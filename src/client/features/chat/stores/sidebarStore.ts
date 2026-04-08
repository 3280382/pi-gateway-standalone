/**
 * Sidebar Store - Zustand State Management
 *
 * 职责（重构后）：
 * - 管理 Sidebar UI 状态
 * - 持久化 lastSessionByDir（目录 -> session 映射）
 * - 通过 sessionManager 协调 session 操作
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { Session, SidebarState } from "@/features/chat/types/sidebar";

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = (): Omit<SidebarState, keyof SidebarActions> => ({
	isVisible: typeof window !== "undefined" ? window.innerWidth >= 768 : true,
	isBottomPanelOpen: false,
	bottomPanelHeight: 300,
	workingDir: null,
	sessions: [],
	isLoading: false,
	error: null,
	selectedSessionId: null,
	// 按工作目录保存最后选中的 session (唯一持久化字段)
	lastSessionByDir: {} as Record<string, string>,
});

// ============================================================================
// Actions Interface
// ============================================================================

interface SidebarActions {
	// Visibility Actions
	setIsVisible: (visible: boolean) => void;
	toggleVisibility: () => void;

	// Bottom Panel Actions
	setBottomPanelOpen: (open: boolean) => void;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;

	// Data Actions
	setWorkingDir: (path: string) => void;
	setSessions: (sessions: Session[]) => void;
	addSession: (session: Session) => void;

	// UI Actions
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	/** 选择 session 并更新 lastSessionByDir */
	selectSession: (id: string | null) => void;
	/** 仅设置 selectedSessionId（不更新 lastSessionByDir，用于 sessionManager） */
	setSelectedSessionId: (id: string | null) => void;
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

				// Visibility Actions
				setIsVisible: (visible: boolean) => {
					set({ isVisible: visible }, false, "setIsVisible");
				},

				toggleVisibility: () => {
					set(
						(state) => ({ isVisible: !state.isVisible }),
						false,
						"toggleVisibility",
					);
				},

				// Bottom Panel Actions
				setBottomPanelOpen: (open: boolean) => {
					set({ isBottomPanelOpen: open }, false, "setBottomPanelOpen");
				},

				closeBottomPanel: () => {
					set({ isBottomPanelOpen: false }, false, "closeBottomPanel");
				},

				setBottomPanelHeight: (height: number) => {
					set({ bottomPanelHeight: height }, false, "setBottomPanelHeight");
				},

				// Data Actions
				setWorkingDir: (path: string) => {
					const displayName = path.split("/").pop() || path;
					set({ workingDir: { path, displayName } }, false, "setWorkingDir");
				},

				setSessions: (sessions: Session[]) => {
					set({ sessions }, false, "setSessions");
				},

				addSession: (session: Session) => {
					set(
						(state) => ({
							sessions: [session, ...state.sessions],
						}),
						false,
						"addSession",
					);
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

				setSelectedSessionId: (id: string | null) => {
					set({ selectedSessionId: id }, false, "setSelectedSessionId");
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
export const selectSessions = (state: SidebarState) => state.sessions;
export const selectSelectedSessionId = (state: SidebarState) =>
	state.selectedSessionId;
export const selectIsLoading = (state: SidebarState) => state.isLoading;
export const selectError = (state: SidebarState) => state.error;
