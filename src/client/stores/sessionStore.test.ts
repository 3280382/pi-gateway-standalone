/**
 * SessionStore Unit Tests
 * 测试纯函数逻辑，不涉及外部环境
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Session, SessionActions, SessionState } from "./sessionStore";

// 创建测试用的 store 实例（不依赖 zustand persist）
function createTestStore(): SessionState & SessionActions {
	const sessions: Session[] = [];
	const recentWorkspaces: string[] = [];

	return {
		// State
		currentSessionId: null,
		sessions,
		currentModel: null,
		thinkingLevel: "medium",
		theme: "dark",
		fontSize: "tiny",
		currentDir: "/root",
		recentWorkspaces,
		serverPid: null,
		isConnected: false,

		// Actions
		setCurrentSession: function (id: string | null) {
			this.currentSessionId = id;
		},

		setSessions: function (sessions: Session[]) {
			this.sessions = sessions;
		},

		addSession: function (session: Session) {
			this.sessions = [session, ...this.sessions];
		},

		removeSession: function (id: string) {
			this.sessions = this.sessions.filter((s) => s.id !== id);
		},

		setCurrentModel: function (model: string | null) {
			this.currentModel = model;
		},

		setThinkingLevel: function (level: typeof this.thinkingLevel) {
			this.thinkingLevel = level;
		},

		setTheme: function (theme: typeof this.theme) {
			this.theme = theme;
		},

		setFontSize: function (size: typeof this.fontSize) {
			this.fontSize = size;
		},

		toggleTheme: function () {
			this.theme = this.theme === "dark" ? "light" : "dark";
		},

		setCurrentDir: function (dir: string) {
			this.currentDir = dir;
		},

		addRecentWorkspace: function (dir: string) {
			const filtered = this.recentWorkspaces.filter((w) => w !== dir);
			this.recentWorkspaces = [dir, ...filtered].slice(0, 5);
		},

		removeRecentWorkspace: function (dir: string) {
			this.recentWorkspaces = this.recentWorkspaces.filter((w) => w !== dir);
		},

		clearRecentWorkspaces: function () {
			this.recentWorkspaces = [];
		},

		setServerPid: function (pid: number | null) {
			this.serverPid = pid;
		},

		setIsConnected: function (connected: boolean) {
			this.isConnected = connected;
		},
	};
}

describe("SessionStore", () => {
	let store: ReturnType<typeof createTestStore>;

	beforeEach(() => {
		store = createTestStore();
	});

	describe("Session Management", () => {
		it("should set current session", () => {
			store.setCurrentSession("session-1");
			expect(store.currentSessionId).toBe("session-1");
		});

		it("should add session to list", () => {
			const session: Session = {
				id: "s1",
				name: "Test Session",
				path: "/path/to/session",
				messageCount: 10,
				lastModified: "2024-01-01",
			};
			store.addSession(session);
			expect(store.sessions).toHaveLength(1);
			expect(store.sessions[0].id).toBe("s1");
		});

		it("should remove session from list", () => {
			const s1: Session = {
				id: "s1",
				name: "S1",
				path: "/p1",
				messageCount: 1,
				lastModified: "",
			};
			const s2: Session = {
				id: "s2",
				name: "S2",
				path: "/p2",
				messageCount: 2,
				lastModified: "",
			};
			store.addSession(s1);
			store.addSession(s2);

			store.removeSession("s1");
			expect(store.sessions).toHaveLength(1);
			expect(store.sessions[0].id).toBe("s2");
		});
	});

	describe("Theme Settings", () => {
		it("should toggle theme between dark and light", () => {
			expect(store.theme).toBe("dark");
			store.toggleTheme();
			expect(store.theme).toBe("light");
			store.toggleTheme();
			expect(store.theme).toBe("dark");
		});

		it("should set theme directly", () => {
			store.setTheme("light");
			expect(store.theme).toBe("light");
		});
	});

	describe("Font Size Settings", () => {
		it("should set font size", () => {
			store.setFontSize("large");
			expect(store.fontSize).toBe("large");
		});
	});

	describe("Model Settings", () => {
		it("should set current model", () => {
			store.setCurrentModel("gpt-4o");
			expect(store.currentModel).toBe("gpt-4o");
		});

		it("should set thinking level", () => {
			store.setThinkingLevel("high");
			expect(store.thinkingLevel).toBe("high");
		});
	});

	describe("Recent Workspaces", () => {
		it("should add workspace to recent list", () => {
			store.addRecentWorkspace("/project1");
			expect(store.recentWorkspaces).toContain("/project1");
		});

		it("should limit recent workspaces to 5", () => {
			store.addRecentWorkspace("/project1");
			store.addRecentWorkspace("/project2");
			store.addRecentWorkspace("/project3");
			store.addRecentWorkspace("/project4");
			store.addRecentWorkspace("/project5");
			store.addRecentWorkspace("/project6");

			expect(store.recentWorkspaces).toHaveLength(5);
			expect(store.recentWorkspaces[0]).toBe("/project6");
			expect(store.recentWorkspaces).not.toContain("/project1");
		});

		it("should move existing workspace to front when re-added", () => {
			store.addRecentWorkspace("/project1");
			store.addRecentWorkspace("/project2");
			store.addRecentWorkspace("/project1"); // re-add

			expect(store.recentWorkspaces[0]).toBe("/project1");
			expect(store.recentWorkspaces).toHaveLength(2);
		});

		it("should remove workspace from recent list", () => {
			store.addRecentWorkspace("/project1");
			store.addRecentWorkspace("/project2");
			store.removeRecentWorkspace("/project1");

			expect(store.recentWorkspaces).not.toContain("/project1");
			expect(store.recentWorkspaces).toContain("/project2");
		});

		it("should clear all recent workspaces", () => {
			store.addRecentWorkspace("/project1");
			store.addRecentWorkspace("/project2");
			store.clearRecentWorkspaces();

			expect(store.recentWorkspaces).toHaveLength(0);
		});
	});

	describe("Server Status", () => {
		it("should set server PID", () => {
			store.setServerPid(12345);
			expect(store.serverPid).toBe(12345);
		});

		it("should set connection status", () => {
			store.setIsConnected(true);
			expect(store.isConnected).toBe(true);
		});
	});

	describe("Working Directory", () => {
		it("should set current directory", () => {
			store.setCurrentDir("/home/user/projects");
			expect(store.currentDir).toBe("/home/user/projects");
		});
	});
});

console.log("[Test] SessionStore tests loaded");
