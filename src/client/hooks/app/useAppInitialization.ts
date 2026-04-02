/**
 * useAppInitialization - 应用初始化 Hook
 * 处理应用启动时的状态恢复、WebSocket连接、会话初始化
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fileController, sessionController } from "@/controllers";
import { websocketService } from "@/services/websocket.service";
import { useChatStore } from "@/stores/chatStore";
import { useNewChatStore } from "@/stores/new-chat.store";
import { useSessionStore } from "@/stores/sessionStore";
import { useSidebarStore } from "@/stores/sidebarStore";

interface InitState {
	isLoading: boolean;
	error: string | null;
}

interface InitResult {
	isLoading: boolean;
	error: string | null;
	retry: () => void;
}

export function useAppInitialization(): InitResult {
	const [state, setState] = useState<InitState>({
		isLoading: true,
		error: null,
	});

	const initRef = useRef(false);

	const initialize = useCallback(async () => {
		if (initRef.current) return;
		initRef.current = true;

		try {
			// 从持久化存储获取之前的状态
			const persistedDir = useSessionStore.getState().currentDir;
			const persistedSessionId = useSessionStore.getState().currentSessionId;

			console.log("[AppInit] Loading persisted state:", {
				persistedDir,
				persistedSessionId,
			});

			// 快速初始化显示（使用持久化的目录）
			if (persistedDir) {
				fileController.setCurrentPath(persistedDir);
				useSidebarStore.getState().setWorkingDir(persistedDir);
			}

			// 后台完整初始化
			await performBackgroundInit(persistedDir, persistedSessionId);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			console.error("[AppInit] Initialization error:", err);
			setState({ isLoading: false, error: errorMsg });
		}
	}, []);

	const performBackgroundInit = async (
		persistedDir: string | null,
		persistedSessionId: string | null,
	) => {
		try {
			await sessionController.getUserSettings();

			// WebSocket 连接
			let wsConnected = false;
			try {
				await websocketService.connect();
				wsConnected = websocketService.isConnected;
				console.log("[AppInit] WebSocket connection status:", wsConnected);
			} catch (wsErr) {
				console.warn("[AppInit] WebSocket connection failed:", wsErr);
			}

			if (wsConnected && persistedDir) {
				await initializeSession(persistedDir, persistedSessionId);
			}
		} catch (bgErr) {
			console.error("[AppInit] Background init error:", bgErr);
		} finally {
			setState({ isLoading: false, error: null });
		}
	};

	const initializeSession = async (
		currentDir: string,
		persistedSessionId: string | null,
	) => {
		try {
			const initData = await websocketService.initWorkingDirectory(
				currentDir,
				persistedSessionId || undefined,
			);

			if (!initData) return;

			console.log("[AppInit] Session initialized:", {
				workingDir: initData.workingDir,
				sessionId: initData.sessionId,
			});

			// 同步服务器返回的状态到本地存储
			syncSessionState(initData);
		} catch (initErr) {
			console.error("[AppInit] initWorkingDirectory error:", initErr);
		}
	};

	const syncSessionState = (initData: {
		workingDir: string;
		sessionId: string;
		pid: number;
		model?: string;
		thinkingLevel?: number;
		resourceFiles?: string[];
		sessionFile?: string;
	}) => {
		const sessionStore = useSessionStore.getState();
		const sidebarStore = useSidebarStore.getState();
		const newChatStore = useNewChatStore.getState();

		// 同步到各 store
		sessionStore.setCurrentDir(initData.workingDir);
		fileController.setCurrentPath(initData.workingDir);
		sidebarStore.setWorkingDir(initData.workingDir);
		sidebarStore.selectSession(initData.sessionId);

		// 保存 session 信息
		newChatStore.setSessionId(initData.sessionId);
		sessionStore.setCurrentSession(initData.sessionId);
		sessionStore.setServerPid(initData.pid);
		sessionStore.setIsConnected(true);

		// 保存配置
		if (initData.model) {
			newChatStore.setCurrentModel(initData.model);
			sessionStore.setCurrentModel(initData.model);
		}
		if (initData.thinkingLevel) {
			sessionStore.setThinkingLevel(initData.thinkingLevel);
		}
		if (initData.resourceFiles) {
			sessionStore.setResourceFiles(initData.resourceFiles);
		}

		// 加载历史消息
		if (initData.sessionFile) {
			useChatStore.getState().loadSession(initData.sessionFile);
		}
	};

	const retry = useCallback(() => {
		initRef.current = false;
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
