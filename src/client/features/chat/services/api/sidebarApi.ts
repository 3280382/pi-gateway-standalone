/**
 * Sidebar API - Controller Layer
 * Connects Zustand Store with Backend API
 */

import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type {
	FontSize,
	SearchFilters,
	Session,
	SessionsResponse,
	SidebarController,
	Theme,
	WorkingDirResponse,
} from "@/features/chat/types/sidebar";
import { fetchApi } from "@/shared/services/api/client";
import { websocketService } from "@/shared/services/websocket.service";

// ============================================================================
// Controller Hook
// ============================================================================

export function useSidebarController(): SidebarController {
	const store = useSidebarStore();

	return {
		// Data Loading
		loadWorkingDir: async () => {
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

		loadRecentWorkspaces: async () => {
			// Zustand persist 会自动从 localStorage 加载
			// 这里不需要额外操作，store 已经包含持久化的数据
			console.log(
				"[SidebarController] recentWorkspaces loaded from persist:",
				store.recentWorkspaces,
			);
		},

		loadSessions: async (cwd: string) => {
			store.setLoading(true);
			try {
				const data = await fetchApi<SessionsResponse>(
					`/sessions?cwd=${encodeURIComponent(cwd)}`,
				);

				const sessions: Session[] = (data.sessions || []).map((s) => ({
					id: s.path,
					path: s.path,
					name:
						s.firstMessage?.slice(0, 35) ||
						s.path.split("/").pop() ||
						"Untitled",
					messageCount: s.messageCount || 0,
					lastModified: new Date(s.modified),
					firstMessage: s.firstMessage,
				}));

				store.setSessions(sessions);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to load sessions";
				store.setError(message);
				console.error("[SidebarController] loadSessions:", error);
			} finally {
				store.setLoading(false);
			}
		},

		// Actions
		selectSession: (id: string) => {
			store.selectSession(id);

			// Load session via WebSocket
			websocketService.send("load_session", { sessionPath: id });
		},

		createNewSession: async () => {
			store.setLoading(true);
			try {
				websocketService.send("new_session");

				// Wait for confirmation
				return new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error("Timeout creating new session"));
					}, 5000);

					const unsubscribe = websocketService.on(
						"session_created",
						async (data) => {
							clearTimeout(timeout);
							store.selectSession(data.sessionId);
							// 保存新session ID到sessionStore用于持久化
							const { useSessionStore } = await import(
								"@/shared/stores/sessionStore"
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

		// Search
		setSearchQuery: (query: string) => {
			console.log("[SidebarController] setSearchQuery:", query);
			store.setSearchQuery(query);

			// Trigger search if needed
			if (query.length > 2) {
				// Could debounce and search
			}
		},

		setSearchFilters: (filters: Partial<SearchFilters>) => {
			store.setSearchFilters(filters);
		},

		// Settings
		setTheme: (theme: Theme) => {
			store.setTheme(theme);

			// Apply to document
			document.body.classList.toggle("light-mode", theme === "light");

			// Save to localStorage via Zustand persist
		},

		setFontSize: (size: FontSize) => {
			store.setFontSize(size);

			// Apply to document
			document.body.classList.remove(
				"font-tiny",
				"font-small",
				"font-medium",
				"font-large",
			);
			document.body.classList.add(`font-${size}`);
		},

		// Error Handling
		clearError: () => {
			store.clearError();
		},

		// Working Directory
		changeWorkingDir: async (path: string) => {
			store.setLoading(true);
			try {
				websocketService.send("change_dir", { path });
				return new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
					const unsub = websocketService.on("dir_changed", async (data) => {
						clearTimeout(timeout);
						
						// 清空旧的 sessions 和选中状态
						store.setSessions([]);
						store.selectSession(null);
						
						store.setWorkingDir(data.cwd);
						const { useSessionStore } = await import(
							"@/shared/stores/sessionStore"
						);
						useSessionStore.getState().setCurrentDir(data.cwd);
						
						// 保存新的session ID（切换目录后会创建新session）
						if (data.sessionId) {
							useSessionStore.getState().setCurrentSession(data.sessionId);
							store.selectSession(data.sessionId);
						}
						
						store.addRecentWorkspace(data.cwd);
						
						// 重新加载新目录的 sessions
						const sessionsData = await fetchApi<SessionsResponse>(
							`/sessions?cwd=${encodeURIComponent(data.cwd)}`,
						);
						const sessions: Session[] = (sessionsData.sessions || []).map((s) => ({
							id: s.path,
							path: s.path,
							name:
								s.firstMessage?.slice(0, 35) ||
								s.path.split("/").pop() ||
								"Untitled",
							messageCount: s.messageCount || 0,
							lastModified: new Date(s.modified),
							firstMessage: s.firstMessage,
						}));
						store.setSessions(sessions);
						
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
	// Direct store access without hook
	const store = useSidebarStore.getState();

	return {
		loadWorkingDir: async () => {
			store.setLoading(true);
			try {
				const { cwd } = await fetchApi<WorkingDirResponse>("/working-dir");
				store.setWorkingDir(cwd);
			} catch (error) {
				store.setError(
					error instanceof Error
						? error.message
						: "Failed to load working directory",
				);
			} finally {
				store.setLoading(false);
			}
		},

		loadRecentWorkspaces: async () => {
			try {
				const data = await fetchApi<{
					workspaces: Array<{ path: string; name: string }>;
				}>("/workspace/recent");
				store.setRecentWorkspaces(data.workspaces || []);
			} catch (error) {
				console.error("[SidebarController] loadRecentWorkspaces:", error);
				store.setRecentWorkspaces([]);
			}
		},

		loadSessions: async (cwd: string) => {
			store.setLoading(true);
			try {
				const data = await fetchApi<SessionsResponse>(
					`/sessions?cwd=${encodeURIComponent(cwd)}`,
				);
				store.setSessions(
					(data.sessions || []).map((s) => ({
						id: s.path,
						name:
							s.firstMessage?.slice(0, 35) ||
							s.path.split("/").pop() ||
							"Untitled",
						messageCount: s.messageCount || 0,
						lastModified: new Date(s.modified),
						firstMessage: s.firstMessage,
					})),
				);
			} catch (error) {
				store.setError(
					error instanceof Error ? error.message : "Failed to load sessions",
				);
			} finally {
				store.setLoading(false);
			}
		},

		changeWorkingDir: async (path: string) => {
			store.setLoading(true);
			try {
				websocketService.send("change_dir", { path });
				return new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
					const unsub = websocketService.on("dir_changed", async (data) => {
						clearTimeout(timeout);
						// 同步更新sidebarStore
						store.setWorkingDir(data.cwd);
						// 同步更新sessionStore
						const { useSessionStore } = await import(
							"@/shared/stores/sessionStore"
						);
						useSessionStore.getState().setCurrentDir(data.cwd);
						// 添加到最近工作区（Zustand persist 会自动保存到 localStorage）
						store.addRecentWorkspace(data.cwd);
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

		createNewSession: async () => {
			store.setLoading(true);
			try {
				websocketService.send("new_session");
				return new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
					const unsub = websocketService.on("session_created", (data) => {
						clearTimeout(timeout);
						store.selectSession(data.sessionId);
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

		setSearchQuery: (query: string) => store.setSearchQuery(query),
		setSearchFilters: (filters: Partial<SearchFilters>) =>
			store.setSearchFilters(filters),
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
