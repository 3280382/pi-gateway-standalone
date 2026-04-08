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

// ============================================================================
// Message Helpers
// ============================================================================

function createUserMessage(text: string): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: "user",
    content: [{ type: "text", text }],
    timestamp: new Date(),
  };
}

function createSystemMessage(text: string): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: "system",
    content: [{ type: "text", text }],
    timestamp: new Date(),
  };
}

function createErrorMessage(error: unknown): Message {
  const errorText = error instanceof Error ? error.message : String(error);
  return createSystemMessage(`命令执行失败: ${errorText}`);
}

// ============================================================================
// Command Execution Helper
// ============================================================================

async function executeCommandWithMessages(
  command: string,
  displayText: string,
  executeFn: (cmd: string) => Promise<any>,
): Promise<void> {
  const chatStore = useChatStore.getState();

  // 添加用户输入消息
  chatStore.addMessage(createUserMessage(displayText));

  try {
    const result = await executeFn(command);
    const resultText = result?.output || result?.error || "命令执行完成";
    chatStore.addMessage(createSystemMessage(resultText));
  } catch (err) {
    chatStore.addMessage(createErrorMessage(err));
  }
}

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
			executeCommandWithMessages(command, `!${command}`, chatController.executeCommand);
		},
		[chatController],
	);

	// 处理 slash 命令
	const handleSlashCommand = useCallback(
		(command: string, args: string) => {
			setShouldScrollToBottom(true);

			// 简单命令处理
			if (command === "clear" || command === "new") {
				chatController.clearMessages();
				return;
			}

			// 需要发送给 LLM 的命令
			if (command !== "bash" && 
				command !== "read" && 
				command !== "write" && 
				command !== "edit" && 
				command !== "ls" && 
				command !== "grep" && 
				command !== "tree" && 
				command !== "git") {
				chatController.sendMessage(`/${command} ${args}`.trim());
				return;
			}

			// 需要执行系统命令的情况
			const isNoArgsCommand = command === "ls" || command === "tree";
			if (!args && !isNoArgsCommand) return;

			const cmdText = args ? `/${command} ${args}` : `/${command}`;
			const executeCmd = cmdText.replace(/^\//, "");
			
			executeCommandWithMessages(executeCmd, cmdText, chatController.executeCommand);
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
