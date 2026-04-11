/**
 * Session Store - Chat Feature 会话状态管理
 * 管理聊天会话、模型设置、连接状态
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import {
	CHAT_SESSION_PERSIST,
	CHAT_STORAGE_KEYS,
	CHAT_STORAGE_VERSION,
} from "./persist.config";

export type ThinkingLevel =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh";

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
				currentSessionId: null,
				sessions: [],
				workingDir: "/root",
				currentModel: null,
				thinkingLevel: "off",
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

				// 服务器状态
				setServerPid: (pid) => set({ serverPid: pid }),
				setIsConnected: (connected) => set({ isConnected: connected }),

				// 资源文件
				setResourceFiles: (files) => set({ resourceFiles: files }),
			}),
			{
				name: CHAT_STORAGE_KEYS.CHAT_SESSION,
				version: CHAT_STORAGE_VERSION.CHAT_SESSION,
				partialize: (state) =>
					Object.fromEntries(
						CHAT_SESSION_PERSIST.map((key) => [key, state[key]]),
					),
			},
		),
		{ name: "ChatSessionStore" },
	),
);
