/**
 * Sidebar API - Controller Layer
 * Connects Zustand Store with Backend API
 */

import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type {
	FontSize,
	Session,
	SessionsResponse,
	SidebarController,
	Theme,
	WorkingDirResponse,
} from "@/features/chat/types/sidebar";
import { fetchApi } from "@/services/client";
import { websocketService } from "@/services/websocket.service";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 将 API 返回的 session 数据转换为 Session 对象
 */
function mapSession(s: SessionsResponse["sessions"][number]): Session {
	return {
		id: s.path,
		path: s.path,
		name: s.firstMessage?.slice(0, 35) || s.path.split("/").pop() || "Untitled",
		messageCount: s.messageCount || 0,
		lastModified: new Date(s.modified),
		firstMessage: s.firstMessage,
	};
}

/**
 * 处理切换工作目录的 WebSocket 响应
 */
async function handleDirChanged(
	data: { cwd: string; sessionId?: string },
	store: ReturnType<typeof useSidebarStore.getState>,
	options: { clearSessions?: boolean; loadSessions?: boolean } = {},
): Promise<void> {
	const { clearSessions = false, loadSessions = false } = options;

	if (clearSessions) {
		store.setSessions([]);
		store.selectSession(null);
	}

	store.setWorkingDir(data.cwd);

	// 同步更新 sessionStore
	const { useSessionStore } = await import("@/stores/sessionStore");
	useSessionStore.getState().setCurrentDir(data.cwd);

	// 保存新的 session ID
	if (data.sessionId) {
		useSessionStore.getState().setCurrentSession(data.sessionId);
		store.selectSession(data.sessionId);
	}

	// 添加到最近工作区
	store.addRecentWorkspace(data.cwd);

	// 重新加载新目录的 sessions
	if (loadSessions) {
		const sessionsData = await fetchApi<SessionsResponse>(
			`/sessions?cwd=${encodeURIComponent(data.cwd)}`,
		);
		store.setSessions((sessionsData.sessions || []).map(mapSession));
	}
}

// ============================================================================
// Store Actions (共享逻辑)
// ============================================================================

const storeActions = {
	loadWorkingDir: async (
		store: ReturnType<typeof useSidebarStore.getState>,
	) => {
		store.setLoading(true);
		try {
			const { cwd } = await fetchApi<WorkingDirResponse>("/working-dir");
			store.setWorkingDir(cwd);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to load working directory";
			store.setError(message);
			console.error("[SidebarController] loadWorkingDir:", error);
		} finally {
			store.setLoading(false);
		}
	},

	loadSessions: async (
		store: ReturnType<typeof useSidebarStore.getState>,
		cwd: string,
	) => {
		store.setLoading(true);
		try {
			const data = await fetchApi<SessionsResponse>(
				`/sessions?cwd=${encodeURIComponent(cwd)}`,
			);
			store.setSessions((data.sessions || []).map(mapSession));
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to load sessions";
			store.setError(message);
			console.error("[SidebarController] loadSessions:", error);
		} finally {
			store.setLoading(false);
		}
	},

	changeWorkingDir: async (
		store: ReturnType<typeof useSidebarStore.getState>,
		path: string,
		options: { clearSessions?: boolean; loadSessions?: boolean } = {
			clearSessions: true,
			loadSessions: true,
		},
	): Promise<void> => {
		store.setLoading(true);
		try {
			websocketService.send("change_dir", { path });
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
				const unsub = websocketService.on("dir_changed", async (data) => {
					clearTimeout(timeout);
					await handleDirChanged(data, store, options);
					unsub();
					resolve();
				});
			});
		} catch (error) {
			store.setError(error instanceof Error ? error.message : "Failed");
			throw error;
		} finally {
			store.setLoading(false);
		}
	},

	createNewSession: async (
		store: ReturnType<typeof useSidebarStore.getState>,
	): Promise<void> => {
		store.setLoading(true);
		try {
			websocketService.send("new_session");
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error("Timeout creating new session")),
					5000,
				);
				const unsubscribe = websocketService.on(
					"session_created",
					async (data) => {
						clearTimeout(timeout);
						store.selectSession(data.sessionId);
						// 保存新 session ID 到 sessionStore 用于持久化
						const { useSessionStore } = await import(
							"@/stores/sessionStore"
						);
						useSessionStore.getState().setCurrentSession(data.sessionId);
						unsubscribe();
						resolve();
					},
				);
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create session";
			store.setError(message);
			throw error;
		} finally {
			store.setLoading(false);
		}
	},
};

// ============================================================================
// Controller Hook
// ============================================================================

export function useSidebarController(): SidebarController {
	const store = useSidebarStore();

	return {
		// Data Loading
		loadWorkingDir: () => storeActions.loadWorkingDir(store),

		loadRecentWorkspaces: async () => {
			// Zustand persist 会自动从 localStorage 加载
			console.log(
				"[SidebarController] recentWorkspaces loaded from persist:",
				store.recentWorkspaces,
			);
		},

		loadSessions: (cwd: string) => storeActions.loadSessions(store, cwd),

		// Actions
		selectSession: (id: string) => {
			store.selectSession(id);
			websocketService.send("load_session", { sessionPath: id });
		},

		createNewSession: () => storeActions.createNewSession(store),

		// Settings
		setTheme: (theme: Theme) => {
			store.setTheme(theme);
			document.body.classList.toggle("light-mode", theme === "light");
		},

		setFontSize: (size: FontSize) => {
			store.setFontSize(size);
			document.body.classList.remove(
				"font-tiny",
				"font-small",
				"font-medium",
				"font-large",
			);
			document.body.classList.add(`font-${size}`);
		},

		// Error Handling
		clearError: () => store.clearError(),

		// Working Directory
		changeWorkingDir: (path: string) =>
			storeActions.changeWorkingDir(store, path, {
				clearSessions: true,
				loadSessions: true,
			}),

		addRecentWorkspace: async (path: string) => {
			try {
				await fetchApi("/workspace/recent", {
					method: "POST",
					body: JSON.stringify({ path }),
				});
			} catch (error) {
				console.error("[SidebarController] addRecentWorkspace:", error);
			}
		},
	};
}

// ============================================================================
// Non-hook API (for non-React contexts)
// ============================================================================

export function createSidebarController(): SidebarController {
	const store = useSidebarStore.getState();

	return {
		loadWorkingDir: () => storeActions.loadWorkingDir(store),

		loadRecentWorkspaces: async () => {
			try {
				const data = await fetchApi<{
					workspaces: Array<{ path: string; name: string }>;
				}>("/workspace/recent");
				store.setRecentWorkspaces((data.workspaces || []).map((w) => w.path));
			} catch (error) {
				console.error("[SidebarController] loadRecentWorkspaces:", error);
				store.setRecentWorkspaces([]);
			}
		},

		loadSessions: (cwd: string) => storeActions.loadSessions(store, cwd),

		changeWorkingDir: (path: string) =>
			storeActions.changeWorkingDir(store, path, {
				clearSessions: false,
				loadSessions: false,
			}),

		addRecentWorkspace: async (path: string) => {
			try {
				await fetchApi("/workspace/recent", {
					method: "POST",
					body: JSON.stringify({ path }),
				});
			} catch (error) {
				console.error("[SidebarController] addRecentWorkspace:", error);
			}
		},

		selectSession: (id: string) => {
			store.selectSession(id);
			websocketService.send("load_session", { sessionPath: id });
		},

		createNewSession: () => storeActions.createNewSession(store),

		setTheme: (theme: Theme) => {
			store.setTheme(theme);
			document.body.classList.toggle("light-mode", theme === "light");
		},
		setFontSize: (size: FontSize) => {
			store.setFontSize(size);
			document.body.classList.remove(
				"font-tiny",
				"font-small",
				"font-medium",
				"font-large",
			);
			document.body.classList.add(`font-${size}`);
		},
		clearError: () => store.clearError(),
	};
}
