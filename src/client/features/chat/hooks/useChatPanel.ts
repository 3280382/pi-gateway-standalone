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
import { useChatController } from "@/features/chat/services/api/chatApi";
import { useChatStore } from "@/features/chat/stores/chatStore";
import type { Message } from "@/features/chat/types/chat";

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
	const currentStreamingMessage = useChatStore(
		(state) => state.currentStreamingMessage,
	);
	const chatController = useChatController();

	// 首次加载时滚动到底部
	useEffect(() => {
		// 使用 setTimeout 确保 DOM 已经渲染完成
		const timer = setTimeout(() => {
			if (messagesRef.current) {
				messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
			}
		}, 100);
		return () => clearTimeout(timer);
	}, []);

	// 消息变化时自动滚动
	useEffect(() => {
		if (messagesRef.current && shouldScrollToBottom) {
			messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
		}
	}, [messages.length, currentStreamingMessage, shouldScrollToBottom]);

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

			// 添加用户输入的消息
			const chatStore = useChatStore.getState();
			const userMessage: Message = {
				id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				role: "user",
				content: [{ type: "text", text: `!${command}` }],
				timestamp: new Date(),
			};
			chatStore.addMessage(userMessage);

			// 执行命令
			chatController
				.executeCommand(command)
				.then((result) => {
					// 添加执行结果
					const resultText = result.output || result.error || "命令执行完成";
					const systemMessage: Message = {
						id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
						role: "system",
						content: [{ type: "text", text: resultText }],
						timestamp: new Date(),
					};
					chatStore.addMessage(systemMessage);
				})
				.catch((err) => {
					// 添加错误消息
					const errorMessage: Message = {
						id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
						role: "system",
						content: [
							{
								type: "text",
								text: `命令执行失败: ${err.message || String(err)}`,
							},
						],
						timestamp: new Date(),
					};
					chatStore.addMessage(errorMessage);
				});
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
					if (args) {
						setShouldScrollToBottom(true);

						// 添加用户输入的消息
						const chatStore = useChatStore.getState();
						const userMessage: Message = {
							id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
							role: "user",
							content: [{ type: "text", text: `/bash ${args}` }],
							timestamp: new Date(),
						};
						chatStore.addMessage(userMessage);

						// 执行命令
						chatController
							.executeCommand(args)
							.then((result) => {
								// 添加执行结果
								const resultText =
									result.output || result.error || "命令执行完成";
								const systemMessage: Message = {
									id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
									role: "system",
									content: [{ type: "text", text: resultText }],
									timestamp: new Date(),
								};
								chatStore.addMessage(systemMessage);
							})
							.catch((err) => {
								// 添加错误消息
								const errorMessage: Message = {
									id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
									role: "system",
									content: [
										{
											type: "text",
											text: `命令执行失败: ${err.message || String(err)}`,
										},
									],
									timestamp: new Date(),
								};
								chatStore.addMessage(errorMessage);
							});
					}
					break;
				case "read":
				case "write":
				case "edit":
				case "ls":
				case "grep":
				case "tree":
				case "git":
					if (args || command === "ls" || command === "tree") {
						setShouldScrollToBottom(true);

						// 添加用户输入的消息
						const chatStore = useChatStore.getState();
						const cmdText = args ? `/${command} ${args}` : `/${command}`;
						const userMessage: Message = {
							id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
							role: "user",
							content: [{ type: "text", text: cmdText }],
							timestamp: new Date(),
						};
						chatStore.addMessage(userMessage);

						// 执行命令
						chatController
							.executeCommand(cmdText.replace(/^\//, ""))
							.then((result) => {
								// 添加执行结果
								const resultText =
									result.output || result.error || "命令执行完成";
								const systemMessage: Message = {
									id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
									role: "system",
									content: [{ type: "text", text: resultText }],
									timestamp: new Date(),
								};
								chatStore.addMessage(systemMessage);
							})
							.catch((err) => {
								// 添加错误消息
								const errorMessage: Message = {
									id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
									role: "system",
									content: [
										{
											type: "text",
											text: `命令执行失败: ${err.message || String(err)}`,
										},
									],
									timestamp: new Date(),
								};
								chatStore.addMessage(errorMessage);
							});
					}
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
