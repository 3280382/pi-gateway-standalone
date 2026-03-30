/**
 * Session Store - 会话状态管理
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type ThinkingLevel =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh";
export type Theme = "dark" | "light";
export type FontSize = "tiny" | "small" | "medium" | "large";

export interface Session {
	id: string;
	name: string;
	path: string;
	messageCount: number;
	lastModified: string;
}

export interface SessionState {
	// 当前会话
	currentSessionId: string | null;
	sessions: Session[];

	// 设置
	currentModel: string | null;
	thinkingLevel: ThinkingLevel;
	theme: Theme;
	fontSize: FontSize;

	// 工作区
	currentDir: string;
	recentWorkspaces: string[];

	// 服务器状态
	serverPid: number | null;
	isConnected: boolean;
}

interface SessionActions {
	// 会话
	setCurrentSession: (id: string | null) => void;
	setSessions: (sessions: Session[]) => void;
	addSession: (session: Session) => void;
	removeSession: (id: string) => void;

	// 设置
	setCurrentModel: (model: string | null) => void;
	setThinkingLevel: (level: ThinkingLevel) => void;
	setTheme: (theme: Theme) => void;
	setFontSize: (size: FontSize) => void;
	toggleTheme: () => void;

	// 工作区
	setCurrentDir: (dir: string) => void;
	addRecentWorkspace: (dir: string) => void;
	removeRecentWorkspace: (dir: string) => void;
	clearRecentWorkspaces: () => void;

	// 服务器状态
	setServerPid: (pid: number | null) => void;
	setIsConnected: (connected: boolean) => void;
}

export const useSessionStore = create<SessionState & SessionActions>()(
	devtools(
		persist(
			(set) => ({
				// 初始状态
				currentSessionId: null,
				sessions: [],
				currentModel: null,
				thinkingLevel: "off",
				theme: "dark",
				fontSize: "tiny",
				currentDir: "/root",
				recentWorkspaces: [],
				serverPid: null,
				isConnected: false,

				// 会话
				setCurrentSession: (id) => set({ currentSessionId: id }),
				setSessions: (sessions) => set({ sessions }),
				addSession: (session) =>
					set((state) => ({
						sessions: [session, ...state.sessions],
					})),
				removeSession: (id) =>
					set((state) => ({
						sessions: state.sessions.filter((s) => s.id !== id),
					})),

				// 设置
				setCurrentModel: (model) => set({ currentModel: model }),
				setThinkingLevel: (level) => set({ thinkingLevel: level }),
				setTheme: (theme) => set({ theme }),
				setFontSize: (size) => set({ fontSize: size }),
				toggleTheme: () =>
					set((state) => ({
						theme: state.theme === "dark" ? "light" : "dark",
					})),

				// 工作区
				setCurrentDir: (dir) => set({ currentDir: dir }),
				addRecentWorkspace: (dir) =>
					set((state) => {
						const filtered = state.recentWorkspaces.filter((w) => w !== dir);
						return { recentWorkspaces: [dir, ...filtered].slice(0, 5) };
					}),
				removeRecentWorkspace: (dir) =>
					set((state) => ({
						recentWorkspaces: state.recentWorkspaces.filter((w) => w !== dir),
					})),
				clearRecentWorkspaces: () => set({ recentWorkspaces: [] }),

				// 服务器状态
				setServerPid: (pid) => set({ serverPid: pid }),
				setIsConnected: (connected) => set({ isConnected: connected }),
			}),
			{
				name: "session-store",
				partialize: (state) => ({
					currentSessionId: state.currentSessionId,
					currentDir: state.currentDir,
					currentModel: state.currentModel,
					thinkingLevel: state.thinkingLevel,
					theme: state.theme,
					fontSize: state.fontSize,
					recentWorkspaces: state.recentWorkspaces,
				}),
			},
		),
		{ name: "SessionStore" },
	),
);
