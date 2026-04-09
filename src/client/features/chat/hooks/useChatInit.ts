/**
 * useChatInit - Chat 页面初始化 Hook
 *
 * 职责：WebSocket 连接、session 恢复
 * 仅在 Chat 页面加载时执行
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/features/files/stores";
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

			// 2. 恢复 session（需要当前工作目录）
			const currentDir = useWorkspaceStore.getState().currentDir;
			if (wsConnected && currentDir) {
				console.log("[ChatInit] 恢复 session:", currentDir);
				await sessionManager.switchDirectory(currentDir, {
					clearSessions: true,
					loadSessions: true,
					restoreLastSession: true,
				});
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
