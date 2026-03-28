/**
 * Sidebar API - Controller Layer
 * Connects Zustand Store with Backend API
 */

import { useSidebarStore } from "@/stores/sidebarStore";
import type {
	FontSize,
	SearchFilters,
	Session,
	SessionsResponse,
	SidebarController,
	Theme,
	WorkingDirResponse,
} from "@/types/sidebar";
import { fetchApi, wsClient } from "./client";

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
				const message = error instanceof Error ? error.message : "Failed to load working directory";
				store.setError(message);
				console.error("[SidebarController] loadWorkingDir:", error);
			} finally {
				store.setLoading(false);
			}
		},

		loadRecentWorkspaces: async () => {
			try {
				// Load from localStorage
				const saved = localStorage.getItem("recentWorkspaces");
				const workspaces = saved ? JSON.parse(saved) : [];
				store.setRecentWorkspaces(workspaces);
			} catch (error) {
				console.error("[SidebarController] loadRecentWorkspaces:", error);
				store.setRecentWorkspaces([]);
			}
		},

		loadSessions: async (cwd: string) => {
			store.setLoading(true);
			try {
				const data = await fetchApi<SessionsResponse>(`/sessions?cwd=${encodeURIComponent(cwd)}`);

				const sessions: Session[] = (data.sessions || []).map((s) => ({
					id: s.path,
					name: s.firstMessage?.slice(0, 35) || s.path.split("/").pop() || "Untitled",
					messageCount: s.messageCount || 0,
					lastModified: new Date(s.modified),
					firstMessage: s.firstMessage,
				}));

				store.setSessions(sessions);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to load sessions";
				store.setError(message);
				console.error("[SidebarController] loadSessions:", error);
			} finally {
				store.setLoading(false);
			}
		},

		// Actions
		changeWorkingDir: async (path: string) => {
			store.setLoading(true);
			try {
				// Send via WebSocket
				wsClient.send({ type: "change_dir", path });

				// Wait for confirmation
				return new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error("Timeout waiting for directory change"));
					}, 5000);

					const unsubscribe = wsClient.on("dir_changed", (data) => {
						clearTimeout(timeout);
						store.setWorkingDir(data.cwd);
						store.addRecentWorkspace(data.cwd);
						unsubscribe();
						resolve();
					});
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to change directory";
				store.setError(message);
				throw error;
			} finally {
				store.setLoading(false);
			}
		},

		selectSession: (id: string) => {
			store.selectSession(id);

			// Load session via WebSocket
			wsClient.send({
				type: "load_session",
				sessionPath: id,
			});
		},

		createNewSession: async () => {
			store.setLoading(true);
			try {
				wsClient.send({ type: "new_session" });

				// Wait for confirmation
				return new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error("Timeout creating new session"));
					}, 5000);

					const unsubscribe = wsClient.on("session_created", (data) => {
						clearTimeout(timeout);
						store.selectSession(data.sessionId);
						unsubscribe();
						resolve();
					});
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to create session";
				store.setError(message);
				throw error;
			} finally {
				store.setLoading(false);
			}
		},

		// Search
		setSearchQuery: (query: string) => {
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
			document.body.classList.remove("font-tiny", "font-small", "font-medium", "font-large");
			document.body.classList.add(`font-${size}`);
		},

		// Error Handling
		clearError: () => {
			store.clearError();
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
				store.setError(error instanceof Error ? error.message : "Failed to load working directory");
			} finally {
				store.setLoading(false);
			}
		},

		loadRecentWorkspaces: async () => {
			try {
				const saved = localStorage.getItem("recentWorkspaces");
				if (!saved) {
					store.setRecentWorkspaces([]);
					return;
				}

				const parsed = JSON.parse(saved);
				// Normalize to WorkspaceInfo format
				const normalized = Array.isArray(parsed)
					? parsed.map((item: any) => {
							if (typeof item === "string") {
								return { path: item, name: item.split("/").pop() || item };
							}
							return {
								path: item?.path || "",
								name: item?.name || item?.path?.split("/").pop() || "",
							};
						})
					: [];
				store.setRecentWorkspaces(normalized);
			} catch {
				store.setRecentWorkspaces([]);
			}
		},

		loadSessions: async (cwd: string) => {
			store.setLoading(true);
			try {
				const data = await fetchApi<SessionsResponse>(`/sessions?cwd=${encodeURIComponent(cwd)}`);
				store.setSessions(
					(data.sessions || []).map((s) => ({
						id: s.path,
						name: s.firstMessage?.slice(0, 35) || s.path.split("/").pop() || "Untitled",
						messageCount: s.messageCount || 0,
						lastModified: new Date(s.modified),
						firstMessage: s.firstMessage,
					})),
				);
			} catch (error) {
				store.setError(error instanceof Error ? error.message : "Failed to load sessions");
			} finally {
				store.setLoading(false);
			}
		},

		changeWorkingDir: async (path: string) => {
			store.setLoading(true);
			try {
				wsClient.send({ type: "change_dir", path });
				return new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
					const unsub = wsClient.on("dir_changed", (data) => {
						clearTimeout(timeout);
						store.setWorkingDir(data.cwd);
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

		selectSession: (id: string) => {
			store.selectSession(id);
			wsClient.send({ type: "load_session", sessionPath: id });
		},

		createNewSession: async () => {
			store.setLoading(true);
			try {
				wsClient.send({ type: "new_session" });
				return new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
					const unsub = wsClient.on("session_created", (data) => {
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
		setSearchFilters: (filters: Partial<SearchFilters>) => store.setSearchFilters(filters),
		setTheme: (theme: Theme) => {
			store.setTheme(theme);
			document.body.classList.toggle("light-mode", theme === "light");
		},
		setFontSize: (size: FontSize) => {
			store.setFontSize(size);
			document.body.classList.remove("font-tiny", "font-small", "font-medium", "font-large");
			document.body.classList.add(`font-${size}`);
		},
		clearError: () => store.clearError(),
	};
}
