/**
 * ChatPanel - Main Chat Container
 *
 * 重构后：
 * - 所有业务逻辑移至 useChatPanel hook
 * - 本组件只负责布局和样式
 */

import { useChatPanel } from "@/features/chat/hooks/useChatPanel";
import { useChatController } from "@/features/chat/services/api/chatApi";
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
	// 从 store 获取状态
	const messages = useChatStore(selectMessages);
	const currentStreamingMessage = useChatStore(selectCurrentStreamingMessage);
	const inputText = useChatStore(selectInputText);
	const isStreaming = useChatStore(selectIsStreaming);
	const showThinking = useChatStore(selectShowThinking);

	// 使用 hook 处理业务逻辑
	const chatPanel = useChatPanel();
	const chatController = useChatController();

	return (
		<div className={styles.panel}>
			<div
				ref={chatPanel.messagesRef}
				className={styles.messages}
				onScroll={chatPanel.handleScroll}
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
