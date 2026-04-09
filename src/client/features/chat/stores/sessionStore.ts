/**
 * Session Store - Chat Feature 会话状态管理
 * 管理聊天会话、模型设置、连接状态
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { CHAT_SESSION_PERSIST, STORAGE_KEYS, STORAGE_VERSION } from "@/stores/persist.config";

// 初始状态
const initialState = {
	currentSessionId: null as string | null,
	workingDir: "/root",
	currentModel: null as string | null,
	thinkingLevel: "off" as ThinkingLevel,
	theme: "dark" as Theme,
	fontSize: "tiny" as FontSize,
};

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

export interface ResourceFiles {
	systemPrompt: {
		global: string;
		project: string;
		loaded: string;
	};
	appendSystemPrompt: Array<{
		path: string;
		exists: boolean;
	}>;
	agentsFiles: Array<{
		path: string;
		exists: boolean;
	}>;
	settings: {
		path: string;
		exists: boolean;
	};
	auth: {
		path: string;
		exists: boolean;
	};
	session: {
		path: string;
		exists: boolean;
	};
	models: {
		path: string;
		exists: boolean;
	};
	skills: {
		global: string;
		project: string;
		loaded: Array<{
			name: string;
			path: string;
		}>;
	};
	prompts: {
		global: string;
		project: string;
	};
}

export interface ChatSessionState {
	// 当前会话
	currentSessionId: string | null;
	sessions: Session[];

	// 当前工作目录
	workingDir: string;

	// 模型设置
	currentModel: string | null;
	thinkingLevel: ThinkingLevel;

	// UI设置
	theme: Theme;
	fontSize: FontSize;

	// 服务器状态
	serverPid: number | null;
	isConnected: boolean;

	// 资源文件路径
	resourceFiles: ResourceFiles | null;
}

interface ChatSessionActions {
	// 会话
	setCurrentSession: (id: string | null) => void;
	setSessions: (sessions: Session[]) => void;
	addSession: (session: Session) => void;
	removeSession: (id: string) => void;

	// 工作目录
	setWorkingDir: (dir: string) => void;

	// 模型设置
	setCurrentModel: (model: string | null) => void;
	setThinkingLevel: (level: ThinkingLevel) => void;

	// UI设置
	setTheme: (theme: Theme) => void;
	setFontSize: (size: FontSize) => void;
	toggleTheme: () => void;

	// 服务器状态
	setServerPid: (pid: number | null) => void;
	setIsConnected: (connected: boolean) => void;

	// 资源文件
	setResourceFiles: (files: ResourceFiles | null) => void;
}

export const useSessionStore = create<ChatSessionState & ChatSessionActions>()(
	devtools(
		persist(
			(set) => ({
				// 初始状态
				currentSessionId: initialState.currentSessionId,
				sessions: [],
				workingDir: initialState.workingDir,
				currentModel: initialState.currentModel,
				thinkingLevel: initialState.thinkingLevel,
				theme: initialState.theme,
				fontSize: initialState.fontSize,
				serverPid: null,
				isConnected: false,
				resourceFiles: null,

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

				// 工作目录
				setWorkingDir: (dir) => set({ workingDir: dir }),

				// 模型设置
				setCurrentModel: (model) => set({ currentModel: model }),
				setThinkingLevel: (level) => set({ thinkingLevel: level }),

				// UI设置
				setTheme: (theme) => set({ theme }),
				setFontSize: (size) => set({ fontSize: size }),
				toggleTheme: () =>
					set((state) => ({
						theme: state.theme === "dark" ? "light" : "dark",
					})),

				// 服务器状态
				setServerPid: (pid) => set({ serverPid: pid }),
				setIsConnected: (connected) => set({ isConnected: connected }),

				// 资源文件
				setResourceFiles: (files) => set({ resourceFiles: files }),
			}),
			{
				name: STORAGE_KEYS.CHAT_SESSION,
            version: STORAGE_VERSION.CHAT_SESSION,
				partialize: (state) => ({
					currentSessionId: state.currentSessionId,
					currentModel: state.currentModel,
					thinkingLevel: state.thinkingLevel,
					theme: state.theme,
					fontSize: state.fontSize,
				}),
			},
		),
		{ name: "ChatSessionStore" },
	),
);
