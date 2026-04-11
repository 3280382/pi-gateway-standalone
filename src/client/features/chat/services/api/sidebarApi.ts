/**
 * Sidebar API - Controller Layer
 *
 * 重构后职责：
 * - 提供 React Hook 接口
 * - 委托给 sessionManager 处理 session 逻辑
 * - 保持向后兼容
 */

import { useCallback } from "react";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type {
	Session,
	SessionsResponse,
	SidebarController,
	WorkingDirResponse,
} from "@/features/chat/types/sidebar";
import { fetchApi } from "@/services/client";

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
		name: s.firstMessage?.slice(0, 35) || s.path?.split("/").pop() || "Untitled",
		messageCount: s.messageCount || 0,
		lastModified: new Date(s.modified),
		firstMessage: s.firstMessage,
	};
}

// ============================================================================
// Controller Hook
// ============================================================================

export function useSidebarController(): SidebarController {
	const store = useSidebarStore();

	return {
		// Data Loading
		loadWorkingDir: useCallback(async () => {
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
				throw error;
			} finally {
				store.setLoading(false);
			}
		}, [store]),

		loadSessions: useCallback(
			async (cwd: string) => {
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
					throw error;
				} finally {
					store.setLoading(false);
				}
			},
			[store],
		),

		// Actions - 委托给 sessionManager
		changeWorkingDir: useCallback(
			(path: string) =>
				sessionManager.switchDirectory(path, {
					clearSessions: true,
					loadSessions: true,
					restoreLastSession: true,
				}),
			[],
		),

		selectSession: useCallback(
			(id: string) => sessionManager.selectSession(id),
			[],
		),

		createNewSession: useCallback(() => sessionManager.createNewSession(), []),

		// Error Handling
		clearError: useCallback(() => store.clearError(), [store]),
	};
}

// ============================================================================
// Non-hook API (for non-React contexts)
// ============================================================================

export function createSidebarController(): SidebarController {
	const store = useSidebarStore.getState();

	return {
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
				throw error;
			} finally {
				store.setLoading(false);
			}
		},

		loadSessions: async (cwd: string) => {
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
				throw error;
			} finally {
				store.setLoading(false);
			}
		},

		changeWorkingDir: (path: string) =>
			sessionManager.switchDirectory(path, {
				clearSessions: false,
				loadSessions: false,
				restoreLastSession: true,
			}),

		selectSession: (id: string) => sessionManager.selectSession(id),

		createNewSession: () => sessionManager.createNewSession(),

		clearError: () => store.clearError(),
	};
}
