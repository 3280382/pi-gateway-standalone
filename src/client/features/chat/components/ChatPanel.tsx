/**
 * ChatPanel - Main Chat Container
 *
 * 职责：
 * - 负责聊天面板的整体布局
 * - 协调 MessageList 和 InputArea 组件
 * - 不包含业务逻辑，只负责视图组合
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { useChatPanel } from "@/features/chat/hooks/useChatPanel";
import { useChatController } from "@/features/chat/services/api/chatApi";
import {
	filterMessages,
	selectCurrentStreamingMessage,
	selectInputText,
	selectIsStreaming,
	selectMessages,
	selectSearchFilters,
	selectSearchQuery,
	selectShowThinking,
	useChatStore,
} from "@/features/chat/stores/chatStore";
import styles from "./ChatPanel.module.css";
import { InputArea } from "./InputArea";
import { MessageList } from "./MessageList";

export function ChatPanel() {
	// ========== 1. State (Domain State from Zustand) ==========
	const messages = useChatStore(selectMessages);
	const currentStreamingMessage = useChatStore(selectCurrentStreamingMessage);
	const inputText = useChatStore(selectInputText);
	const isStreaming = useChatStore(selectIsStreaming);
	const showThinking = useChatStore(selectShowThinking);
	const searchQuery = useChatStore(selectSearchQuery);
	const searchFilters = useChatStore(selectSearchFilters);

	// ========== 2. Hooks (Business Logic) ==========
	const chatPanel = useChatPanel();
	const chatController = useChatController();

	// ========== 3. Computed ==========
	// 应用搜索过滤
	const filteredMessages = filterMessages(messages, {
		query: searchQuery,
		filters: searchFilters,
	});

	// ========== 4. Render ==========
	return (
		<div className={styles.panel}>
			<div
				ref={chatPanel.messagesRef}
				className={styles.messages}
				onScroll={chatPanel.handleScroll}
			>
				<MessageList
					messages={filteredMessages}
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
					onSend={chatPanel.handleSend}
					onAbort={chatController.abortGeneration}
					onBashCommand={chatPanel.handleBashCommand}
					onSlashCommand={chatPanel.handleSlashCommand}
					onNewSession={chatPanel.handleNewSession}
				/>
			</div>
		</div>
	);
}
