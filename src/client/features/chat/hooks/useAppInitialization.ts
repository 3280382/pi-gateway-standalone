/**
 * useAppInitialization - 应用初始化 Hook
 * 
 * 重构后：
 * - 使用 sessionManager 统一处理 session 初始化
 * - 简化 WebSocket 连接和状态恢复逻辑
 */

import { useCallback, useEffect, useState } from "react";
import { setupWebSocketListeners } from "@/features/chat/services/api/chatApi";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { useWorkspaceStore } from "@/features/files/stores";
import { websocketService } from "@/services/websocket.service";

interface InitState {
	isLoading: boolean;
	error: string | null;
}

interface InitResult {
	isLoading: boolean;
	error: string | null;
	retry: () => void;
}

// 全局初始化标志，防止 React 18 严格模式重复初始化
let globalInitStarted = false;
let globalInitPromise: Promise<void> | null = null;

export function useAppInitialization(): InitResult {
	const [state, setState] = useState<InitState>({
		isLoading: true,
		error: null,
	});

	const initialize = useCallback(async () => {
		// 如果全局初始化已经开始，等待它完成
		if (globalInitStarted) {
			if (globalInitPromise) {
				await globalInitPromise;
			}
			setState({ isLoading: false, error: null });
			return;
		}

		globalInitStarted = true;

		const initTask = async () => {
			try {
				// 1. WebSocket 连接（带超时，快速失败）
				let wsConnected = false;
				try {
					await websocketService.connect(undefined, 10000);
					wsConnected = websocketService.isConnected;
					console.log("[AppInit] WebSocket connected");
					setupWebSocketListeners();
				} catch (wsErr) {
					console.warn("[AppInit] WebSocket not available, continuing without it");
				}

				// 2. 恢复上次工作目录和 session
				const persistedDir = useWorkspaceStore.getState().currentDir;
				
				if (wsConnected && persistedDir) {
					console.log("[AppInit] 恢复工作目录:", persistedDir);
					
					// 使用 sessionManager 统一处理目录切换和 session 恢复
					await sessionManager.switchDirectory(persistedDir, {
						clearSessions: true,
						loadSessions: true,
						restoreLastSession: true,
					});
				}

				console.log("[AppInit] 初始化完成");
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				console.error("[AppInit] 初始化错误:", err);
				// 即使出错也结束加载，让应用可用
			}
		};

		// 使用 Promise.race 确保最多等待 15 秒
		globalInitPromise = Promise.race([
			initTask(),
			new Promise<void>((_, reject) =>
				setTimeout(() => reject(new Error("Init timeout")), 15000)
			),
		]).catch((err) => {
			console.warn("[AppInit] 初始化超时或错误:", err);
		});

		await globalInitPromise;
		setState({ isLoading: false, error: null });
	}, []);

	const retry = useCallback(() => {
		globalInitStarted = false;
		globalInitPromise = null;
		setState({ isLoading: true, error: null });
		initialize();
	}, [initialize]);

	useEffect(() => {
		initialize();
	}, [initialize]);

	return {
		isLoading: state.isLoading,
		error: state.error,
		retry,
	};
}
