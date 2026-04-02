/**
 * ChatPanel - Main Chat Container
 */

import { useCallback, useEffect, useRef } from "react";
import { chatController } from "@/features/chat/controllers";
import {
	selectCurrentStreamingMessage,
	selectInputText,
	selectIsStreaming,
	selectMessages,
	selectShowThinking,
	useChatStore,
} from "@/features/chat/stores/chatStore";
import styles from "./ChatPanel.module.css";
import { InputArea } from "./InputArea";
import { MessageList } from "./MessageList";

export function ChatPanel() {
	const messages = useChatStore(selectMessages);
	const currentStreamingMessage = useChatStore(selectCurrentStreamingMessage);
	const inputText = useChatStore(selectInputText);
	const isStreaming = useChatStore(selectIsStreaming);
	const showThinking = useChatStore(selectShowThinking);
	const showTools = useChatStore((state) => state.showTools);

	const messagesRef = useRef<HTMLDivElement>(null);
	const shouldScrollRef = useRef(true);

	// Auto-scroll to bottom when messages change or streaming
	useEffect(() => {
		if (messagesRef.current && shouldScrollRef.current) {
			messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
		}
	}, [messages, currentStreamingMessage]);

	// Handle scroll to detect if user has manually scrolled up
	const handleScroll = useCallback(() => {
		if (messagesRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = messagesRef.current;
			const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
			shouldScrollRef.current = isAtBottom;
		}
	}, []);

	const handleSend = useCallback(async () => {
		console.log("[ChatPanel] handleSend called, inputText:", inputText);
		if (inputText.trim()) {
			console.log("[ChatPanel] Calling chatController.sendMessage");
			try {
				await chatController.sendMessage(inputText);
				console.log("[ChatPanel] sendMessage completed");
			} catch (err) {
				console.error("[ChatPanel] sendMessage failed:", err);
			}
			// Reset scroll flag on new message
			shouldScrollRef.current = true;
		} else {
			console.log("[ChatPanel] inputText is empty, not sending");
		}
	}, [inputText]);

	const handleBashCommand = useCallback(
		(command: string) => {
			chatController.setInputText(`/bash ${command}`);
			setTimeout(() => chatController.sendMessage(`/bash ${command}`), 0);
			shouldScrollRef.current = true;
		},
		[],
	);

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
			}
			shouldScrollRef.current = true;
		},
		[],
	);

	const handleNewSession = useCallback(() => {
		chatController.clearMessages();
	}, []);

	return (
		<div className={styles.panel}>
			<div
				ref={messagesRef}
				className={styles.messages}
				onScroll={handleScroll}
			>
				<MessageList
					messages={messages}
					currentStreamingMessage={currentStreamingMessage}
					showThinking={showThinking}
					onToggleMessageCollapse={chatController.toggleMessageCollapse}
					onToggleThinkingCollapse={chatController.toggleThinkingCollapse}
					onToggleToolsCollapse={chatController.toggleToolsCollapse}
					onDeleteMessage={chatController.deleteMessage}
					onRegenerateMessage={chatController.regenerateMessage}
				/>
			</div>

			<div className={styles.input}>
				<InputArea
					value={inputText}
					isStreaming={isStreaming}
					onChange={chatController.setInputText}
					onSend={handleSend}
					onAbort={chatController.abortGeneration}
					onBashCommand={handleBashCommand}
					onSlashCommand={handleSlashCommand}
					onNewSession={handleNewSession}
				/>
			</div>
		</div>
	);
}
