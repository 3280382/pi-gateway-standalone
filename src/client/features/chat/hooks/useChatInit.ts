/**
 * useChatInit - Chat 页面初始化 Hook
 *
 * 职责：WebSocket 连接、session 恢复
 * 仅在 Chat 页面加载时执行
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { websocketService } from "@/services/websocket.service";
import { setupWebSocketListeners } from "../services/api/chatApi";
import { sessionManager } from "../services/sessionManager";

export function useChatInit(): { isConnecting: boolean } {
	const [isConnecting, setIsConnecting] = useState(true);
	// 防止 StrictMode 下的重复初始化
	const hasInitialized = useRef(false);

	const initialize = useCallback(async () => {
		// 防止重复初始化
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

			// 2. 恢复 session（只在需要时）
			// 检查是否已经有 active session，避免重复切换
			const currentSessionId = useSessionStore.getState().currentSessionId;
			const workingDir = useSessionStore.getState().workingDir;
			
			if (wsConnected && workingDir && !currentSessionId) {
				console.log("[ChatInit] 没有 active session，恢复上次的工作目录:", workingDir);
				await sessionManager.switchDirectory(workingDir, {
					clearSessions: true,
					loadSessions: true,
					restoreLastSession: true,
				});
			} else {
				console.log("[ChatInit] 已有 session 或未设置工作目录，跳过自动恢复");
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
