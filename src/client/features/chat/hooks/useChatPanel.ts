/**
 * useChatPanel - ChatPanel 组件业务逻辑 Hook
 *
 * 职责：
 * - 管理消息列表自动滚动逻辑
 * - 处理消息发送协调
 * - 处理 bash/slash 命令
 * - 管理新会话创建
 */

import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatController } from "@/features/chat/services/api/chatApi";

export interface UseChatPanelReturn {
	// Refs
	messagesRef: React.RefObject<HTMLDivElement | null>;

	// 滚动相关
	handleScroll: () => void;

	// 消息操作
	handleSend: () => Promise<void>;
	handleBashCommand: (command: string) => void;
	handleSlashCommand: (command: string, args: string) => void;
	handleNewSession: () => Promise<void>;
}

export function useChatPanel(): UseChatPanelReturn {
	const messagesRef = useRef<HTMLDivElement>(null);
	const shouldScrollRef = useRef(true);

	const inputText = useChatStore((state) => state.inputText);
	const chatController = useChatController();

	// 自动滚动到底部
	useEffect(() => {
		if (messagesRef.current && shouldScrollRef.current) {
			messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
		}
	}, [
		// 依赖 messages 和 currentStreamingMessage，但不在 store 中订阅
		// 这个 effect 由 ChatPanel 组件的 render 触发
	]);

	// 处理滚动事件，检测用户是否手动向上滚动
	const handleScroll = useCallback(() => {
		if (messagesRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = messagesRef.current;
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
			shouldScrollRef.current = isAtBottom;
		}
	}, []);

	// 发送消息
	const handleSend = useCallback(async () => {
		if (inputText.trim()) {
			try {
				await chatController.sendMessage(inputText);
			} catch (err) {
				console.error("[useChatPanel] sendMessage failed:", err);
			}
			// 新消息时重置滚动标志
			shouldScrollRef.current = true;
		}
	}, [inputText, chatController]);

	// 处理 bash 命令
	const handleBashCommand = useCallback(
		(command: string) => {
			chatController.setInputText(`/bash ${command}`);
			setTimeout(() => chatController.sendMessage(`/bash ${command}`), 0);
			shouldScrollRef.current = true;
		},
		[chatController],
	);

	// 处理 slash 命令
	const handleSlashCommand = useCallback(
		(command: string, args: string) => {
			switch (command) {
				case "clear":
					chatController.clearMessages();
					break;
				case "new":
					chatController.clearMessages();
					break;
				case "bash":
					if (args) chatController.sendMessage(`/bash ${args}`);
					break;
				case "read":
					if (args) chatController.sendMessage(`/read ${args}`);
					break;
				default:
					chatController.sendMessage(`/${command} ${args}`.trim());
					break;
			}
			shouldScrollRef.current = true;
		},
		[chatController],
	);

	// 创建新会话
	const handleNewSession = useCallback(async () => {
		await chatController.createNewSession();
	}, [chatController]);

	return {
		messagesRef,
		handleScroll,
		handleSend,
		handleBashCommand,
		handleSlashCommand,
		handleNewSession,
	};
}
