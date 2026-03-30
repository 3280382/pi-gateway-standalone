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
import { useSessionStore } from "@/stores/sessionStore";
import { TopBar } from "../../layout/TopBar/TopBar";
import { InputArea } from "../InputArea/InputArea";
import { MessageList } from "../MessageList/MessageList";
import styles from "./ChatPanel.module.css";

export function ChatPanel() {
	const messages = useChatStore(selectMessages);
	const currentStreamingMessage = useChatStore(selectCurrentStreamingMessage);
	const inputText = useChatStore(selectInputText);
	const isStreaming = useChatStore(selectIsStreaming);
	const showThinking = useChatStore(selectShowThinking);

	const { currentDir, isConnected, serverPid } = useSessionStore();
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

	const connectionStatus = isConnected ? "connected" : "disconnected";

	return (
		<div className={styles.panel}>
			<div className={styles.header}>
				<TopBar
					workingDir={currentDir}
					connectionStatus={connectionStatus}
					pid={serverPid}
				/>
			</div>

			<div className={styles.messages}>
				<MessageList
					messages={messages}
					currentStreamingMessage={currentStreamingMessage}
					showThinking={showThinking}
					onToggleMessageCollapse={controller.toggleMessageCollapse}
					onToggleThinkingCollapse={controller.toggleThinkingCollapse}
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
