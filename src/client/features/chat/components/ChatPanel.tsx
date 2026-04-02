/**
 * ChatPanel - Main Chat Container
 */

import { useCallback } from "react";
import { useChatController } from "@/services/api/chatApi";
import {
	selectCurrentStreamingMessage,
	selectInputText,
	selectIsStreaming,
	selectMessages,
	selectShowThinking,
	useChatStore,
} from "@/stores/chatStore";
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

	const controller = useChatController();

	const handleSend = useCallback(() => {
		if (inputText.trim()) {
			controller.sendMessage(inputText);
		}
	}, [inputText, controller]);

	const handleBashCommand = useCallback(
		(command: string) => {
			controller.setInputText(`/bash ${command}`);
			setTimeout(() => controller.sendMessage(`/bash ${command}`), 0);
		},
		[controller],
	);

	const handleSlashCommand = useCallback(
		(command: string, args: string) => {
			switch (command) {
				case "clear":
					controller.clearMessages();
					break;
				case "new":
					controller.clearMessages();
					break;
				case "bash":
					if (args) controller.sendMessage(`/bash ${args}`);
					break;
				case "read":
					if (args) controller.sendMessage(`/read ${args}`);
					break;
				default:
					controller.sendMessage(`/${command} ${args}`.trim());
			}
		},
		[controller],
	);

	return (
		<div className={styles.panel}>
			<div className={styles.messages}>
				<MessageList
					messages={messages}
					currentStreamingMessage={currentStreamingMessage}
					showThinking={showThinking}
					onToggleMessageCollapse={controller.toggleMessageCollapse}
					onToggleThinkingCollapse={controller.toggleThinkingCollapse}
					onToggleToolsCollapse={controller.toggleToolsCollapse}
					onDeleteMessage={controller.deleteMessage}
					onRegenerateMessage={controller.regenerateMessage}
				/>
			</div>

			<div className={styles.input}>
				<InputArea
					value={inputText}
					isStreaming={isStreaming}
					onChange={controller.setInputText}
					onSend={handleSend}
					onAbort={controller.abortGeneration}
					onBashCommand={handleBashCommand}
					onSlashCommand={handleSlashCommand}
				/>
			</div>
		</div>
	);
}
