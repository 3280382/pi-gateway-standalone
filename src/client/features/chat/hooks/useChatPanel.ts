/**
 * useChatPanel - ChatPanel 组件业务逻辑 Hook
 *
 * 职责：
 * - 管理消息列表自动滚动逻辑
 * - 处理消息发送协调
 * - 处理 bash/slash 命令
 * - 管理新会话创建
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChatController } from "@/features/chat/services/api/chatApi";

export interface UseChatPanelReturn {
	// Refs
	messagesRef: React.RefObject<HTMLDivElement | null>;

	// 滚动相关
	shouldScrollToBottom: boolean;
	setShouldScrollToBottom: (value: boolean) => void;
	handleScroll: () => void;

	// 消息操作
	handleSend: () => Promise<void>;
	handleBashCommand: (command: string) => void;
	handleSlashCommand: (command: string, args: string) => void;
	handleNewSession: () => Promise<void>;
}

export function useChatPanel(): UseChatPanelReturn {
	const messagesRef = useRef<HTMLDivElement>(null);
	
	// 使用 state 而不是 ref，这样可以在变化时触发重新渲染和 useEffect
	const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

	const inputText = useChatStore((state) => state.inputText);
	const messages = useChatStore((state) => state.messages);
	const currentStreamingMessage = useChatStore((state) => state.currentStreamingMessage);
	const chatController = useChatController();

	// 自动滚动到底部
	useEffect(() => {
		if (messagesRef.current && shouldScrollToBottom) {
			messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
		}
	}, [messages, currentStreamingMessage, shouldScrollToBottom]);

	// 处理滚动事件，检测用户是否手动向上滚动
	const handleScroll = useCallback(() => {
		if (messagesRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = messagesRef.current;
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
			// 用户向上滚动时，暂停自动滚动
			if (!isAtBottom && shouldScrollToBottom) {
				setShouldScrollToBottom(false);
			}
		}
	}, [shouldScrollToBottom]);

	// 发送消息 - 重新启用自动滚动
	const handleSend = useCallback(async () => {
		if (inputText.trim()) {
			// 先重置滚动标志，确保新消息会滚动到底部
			setShouldScrollToBottom(true);
			try {
				await chatController.sendMessage(inputText);
			} catch (err) {
				console.error("[useChatPanel] sendMessage failed:", err);
			}
		}
	}, [inputText, chatController]);

	// 处理 bash 命令
	const handleBashCommand = useCallback(
		(command: string) => {
			setShouldScrollToBottom(true);
			chatController.setInputText(`/bash ${command}`);
			setTimeout(() => chatController.sendMessage(`/bash ${command}`), 0);
		},
		[chatController],
	);

	// 处理 slash 命令
	const handleSlashCommand = useCallback(
		(command: string, args: string) => {
			setShouldScrollToBottom(true);
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
		},
		[chatController],
	);

	// 创建新会话
	const handleNewSession = useCallback(async () => {
		setShouldScrollToBottom(true);
		await chatController.createNewSession();
	}, [chatController]);

	return {
		messagesRef,
		shouldScrollToBottom,
		setShouldScrollToBottom,
		handleScroll,
		handleSend,
		handleBashCommand,
		handleSlashCommand,
		handleNewSession,
	};
}
