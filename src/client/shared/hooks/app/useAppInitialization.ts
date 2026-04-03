/**
 * useAppInitialization - 应用初始化 Hook
 * 处理应用启动时的状态恢复、WebSocket连接、会话初始化
 */

import { useCallback, useEffect, useState } from "react";
import { chatController } from "@/features/chat/controllers";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { fileController, sessionController } from "@/shared/controllers";
import { websocketService } from "@/shared/services/websocket.service";
import { useSessionStore } from "@/shared/stores/sessionStore";

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

	const performBackgroundInit = useCallback(
		async (persistedDir: string | null, persistedSessionId: string | null) => {
			try {
				// 并行获取用户设置，不阻塞
				sessionController.getUserSettings().catch(() => {});

				// WebSocket 连接（带超时，快速失败）
				let wsConnected = false;
				try {
					await websocketService.connect(undefined, 2000);
					wsConnected = websocketService.isConnected;
					console.log("[AppInit] WebSocket connected");

					// 设置 chat controller 的 WebSocket 监听器
					chatController.setupWebSocketListeners();
				} catch (wsErr) {
					console.warn(
						"[AppInit] WebSocket not available, continuing without it",
					);
				}

				// 仅在 WebSocket 连接成功时初始化会话（1秒超时，非阻塞）
				console.log("[AppInit] 准备初始化会话:", {
					persistedDir,
					persistedSessionId,
				});
				if (wsConnected && persistedDir) {
					initializeSession(persistedDir, persistedSessionId).catch((err) => {
						console.warn("[AppInit] Session init failed:", err);
					});
				}
			} catch (bgErr) {
				console.error("[AppInit] Background init error:", bgErr);
			}
		},
		[],
	);

	// 初始化函数 - 使用全局标志防止重复
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
				// 从持久化存储获取之前的状态
				const persistedDir = useSessionStore.getState().currentDir;
				const persistedSessionId = useSessionStore.getState().currentSessionId;

				console.log("[AppInit] Loading persisted state:", {
					persistedDir,
					persistedSessionId,
				});

				// 快速初始化显示（使用持久化的目录）- 不阻塞
				if (persistedDir) {
					fileController.setCurrentPath(persistedDir);
					useSidebarStore.getState().setWorkingDir(persistedDir);
				}

				// 后台完整初始化（不阻塞 UI），最多等待 3 秒
				await Promise.race([
					performBackgroundInit(persistedDir, persistedSessionId),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error("Init timeout")), 3000),
					),
				]).catch((err) => {
					console.warn("[AppInit] Background init timeout or error:", err);
				});
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				console.error("[AppInit] Initialization error:", err);
				// 即使出错也结束加载，让应用可用
			}
		};

		globalInitPromise = initTask();
		await globalInitPromise;
		setState({ isLoading: false, error: null });
	}, [performBackgroundInit]);

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
			await syncSessionState(initData);
		} catch (initErr) {
			console.error("[AppInit] initWorkingDirectory error:", initErr);
		}
	};

	const syncSessionState = async (initData: {
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
		const chatStore = useChatStore.getState();

		// 同步到各 store（仅在变化时更新，避免重复触发）
		if (sessionStore.currentDir !== initData.workingDir) {
			sessionStore.setCurrentDir(initData.workingDir);
		}
		fileController.setCurrentPath(initData.workingDir);
		if (sidebarStore.workingDir?.path !== initData.workingDir) {
			sidebarStore.setWorkingDir(initData.workingDir);
		}

		// 保存 session 信息 - 以服务端返回的 session 为准
		chatStore.setSessionId(initData.sessionId);
		sessionStore.setCurrentSession(initData.sessionId); // 更新浏览器保存的 sessionId
		sidebarStore.selectSession(initData.sessionId); // 同步更新 sidebar 的选中状态
		sessionStore.setServerPid(initData.pid);
		sessionStore.setIsConnected(true);

		// 保存配置
		if (initData.model) {
			chatStore.setCurrentModel(initData.model);
			sessionStore.setCurrentModel(initData.model);
		}
		if (initData.thinkingLevel) {
			sessionStore.setThinkingLevel(initData.thinkingLevel);
		}
		if (initData.resourceFiles) {
			sessionStore.setResourceFiles(initData.resourceFiles);
		}

		// 加载历史消息 - 直接使用服务端返回的 sessionFile
		// 服务端 initWorkingDirectory 返回的 session 是服务器认定的当前 session
		// 浏览器保存的 sessionId 会被服务端返回的覆盖
		if (initData.sessionFile) {
			console.log("[AppInit] Loading session from:", initData.sessionFile);
			const result = await chatStore.loadSession(initData.sessionFile);
			if (result === 0) {
				console.log(
					"[AppInit] Session file empty (new session):",
					initData.sessionFile,
				);
			} else {
				console.log("[AppInit] Loaded", result, "messages");
			}
		} else {
			console.warn("[AppInit] No session file returned from server");
		}
	};

	const retry = useCallback(() => {
		// 重置全局标志
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
