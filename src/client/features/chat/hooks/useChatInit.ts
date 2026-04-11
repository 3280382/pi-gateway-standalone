/**
 * useChatInit - Chat 页面初始化 Hook
 *
 * 职责：WebSocket 连接、session 恢复
 * 仅在 Chat 页面加载时执行
 */

// ===== [ANCHOR:IMPORTS] =====

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { websocketService } from "@/services/websocket.service";
import { setupWebSocketListeners } from "../services/api/chatApi";
import { initChatWorkingDirectory } from "../services/chatWebSocket";
import { sessionManager } from "../services/sessionManager";

// ===== [ANCHOR:TYPES] =====

interface InitResponse {
	cwd: string;
	sessionId?: string;
	sessionFile?: string;
	pid?: number;
	model?: string;
	thinkingLevel?: string;
}

// ===== [ANCHOR:HOOK] =====

export function useChatInit(): { isConnecting: boolean } {
	const [isConnecting, setIsConnecting] = useState(true);
	const hasInitialized = useRef(false);

	const initialize = useCallback(async () => {
		if (hasInitialized.current) return;
		hasInitialized.current = true;

		try {
			// 1. WebSocket 连接
			let wsConnected = false;
			try {
				await websocketService.connect(undefined, 10000);
				wsConnected = websocketService.isConnected;
				console.log("[ChatInit] WebSocket connected");
				setupWebSocketListeners();
			} catch {
				console.warn("[ChatInit] WebSocket not available");
			}

			if (!wsConnected) {
				setIsConnecting(false);
				return;
			}

			// 2. 尝试获取服务器当前状态（reconnect 场景）
			const savedWorkingDir = useSessionStore.getState().workingDir;
			const currentSessionId = useSessionStore.getState().currentSessionId;

			// 先尝试 init 获取服务器当前状态
			const initResponse = await new Promise<InitResponse | null>((resolve) => {
				const timeout = setTimeout(() => {
					console.log("[ChatInit] init timeout, no active session on server");
					resolve(null);
				}, 3000);

				const unsub = websocketService.on("initialized", (data: unknown) => {
					clearTimeout(timeout);
					unsub();
					resolve(data as InitResponse);
				});

				// 发送 init 请求
				initChatWorkingDirectory(savedWorkingDir || "/root", undefined);
			});

			// 3. 如果服务器返回 active session，恢复 UI
			if (initResponse?.sessionId && initResponse?.sessionFile) {
				console.log("[ChatInit] 服务器已有 session，恢复 UI:", {
					sessionId: initResponse.sessionId,
					cwd: initResponse.cwd,
				});

				// 更新所有 store 状态
				useSessionStore.getState().setCurrentSession(initResponse.sessionId);
				useSessionStore.getState().setWorkingDir(initResponse.cwd);
				useSidebarStore.getState().setWorkingDir(initResponse.cwd);
				useSessionStore.getState().setIsConnected(true);

				if (initResponse.pid) {
					useSessionStore.getState().setServerPid(initResponse.pid);
				}
				if (initResponse.model) {
					useSessionStore.getState().setCurrentModel(initResponse.model);
				}
				if (initResponse.thinkingLevel) {
					useSessionStore
						.getState()
						.setThinkingLevel(initResponse.thinkingLevel as any);
				}

				// 加载 session 消息历史
				await useChatStore.getState().loadSession(initResponse.sessionFile);

				// 加载 sessions 列表
				const sessions = await sessionManager.loadSessionsList(
					initResponse.cwd,
				);
				useSidebarStore.getState().setSessions(sessions);

				// 选中当前 session
				useSidebarStore
					.getState()
					.setSelectedSessionId(initResponse.sessionFile);
			}
			// 4. 如果没有 active session，但有保存的工作目录，恢复它
			else if (savedWorkingDir && !currentSessionId) {
				console.log("[ChatInit] 恢复上次工作目录:", savedWorkingDir);
				await sessionManager.switchDirectory(savedWorkingDir, {
					clearSessions: true,
					loadSessions: true,
					restoreLastSession: true,
				});
			}
			// 5. 如果已有 currentSessionId，只需确保连接状态
			else if (currentSessionId) {
				console.log("[ChatInit] 已有 active session，更新连接状态");
				useSessionStore.getState().setIsConnected(true);
			}
		} catch (err) {
			console.error("[ChatInit] 初始化错误:", err);
		} finally {
			setIsConnecting(false);
		}
	}, []);

	useEffect(() => {
		initialize();
	}, [initialize]);

	return { isConnecting };
}
