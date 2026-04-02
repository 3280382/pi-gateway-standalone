/**
 * ChatPanel - Main Chat Container
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useChatController } from "@/services/api/chatApi";
import {
	filterMessages,
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
	const showTools = useChatStore((state) => state.showTools);

	const { currentDir, isConnected, serverPid } = useSessionStore();
	const controller = useChatController();

	// 搜索状态 - 使用本地 state
	const [searchQuery, setSearchQuery] = useState("");
	const [searchFilters, setSearchFilters] = useState({
		user: true,
		assistant: true,
		thinking: true,
		tools: true,
	});

	// DEBUG: Check state and setter
	console.log("[ChatPanel] State check:", {
		searchQuery,
		setSearchQuery: typeof setSearchQuery,
		searchFilters,
		setSearchFilters: typeof setSearchFilters,
	});

	// 使用 useMemo 缓存过滤结果
	const filteredMessages = useMemo(() => {
		console.log("[ChatPanel] Filtering messages:", {
			totalMessages: messages.length,
			searchQuery,
			searchFilters,
		});
		const result = filterMessages(messages, {
			query: searchQuery,
			filters: searchFilters,
		});
		console.log("[ChatPanel] Filtered result:", result.length, "messages");
		return result;
	}, [messages, searchQuery, searchFilters]);

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
					searchQuery={searchQuery}
					searchFilters={searchFilters}
					onSearchQueryChange={setSearchQuery}
					onSearchFiltersChange={setSearchFilters}
				/>
			</div>

			<div className={styles.messages}>
				<MessageList
					messages={filteredMessages}
					currentStreamingMessage={currentStreamingMessage}
					showThinking={showThinking}
					showTools={showTools}
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
