/**
 * MessageList - Message list component
 *
 * 职责：
 * - 渲染消息列表
 * - 处理空状态显示
 * - 注意：滚动逻辑由父组件处理
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { useMemo } from "react";
import type { Message } from "@/features/chat/types/chat";
import { MessageItem } from "./MessageItem";
import styles from "./MessageList.module.css";

// ============================================================================
// Types
// ============================================================================

interface MessageListProps {
	messages: Message[];
	currentStreamingMessage: Message | null;
	showThinking: boolean;
	showTools?: boolean;
	onToggleMessageCollapse: (id: string) => void;
	onToggleThinkingCollapse: (id: string) => void;
	onToggleToolsCollapse?: (id: string) => void;
	onDeleteMessage?: (id: string) => void;
	onRegenerateMessage?: (id: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function MessageList({
	messages,
	currentStreamingMessage,
	showThinking,
	showTools,
	onToggleMessageCollapse,
	onToggleThinkingCollapse,
	onToggleToolsCollapse,
	onDeleteMessage,
	onRegenerateMessage,
}: MessageListProps) {
	// ========== 4. Computed ==========
	// Merge messages with current streaming message, avoid duplicates
	const allMessages = useMemo(() => {
		if (!currentStreamingMessage) return messages;

		// Check if streaming message already exists in messages
		const exists = messages.some((m) => m.id === currentStreamingMessage.id);
		return exists ? messages : [...messages, currentStreamingMessage];
	}, [messages, currentStreamingMessage]);

	// Filter valid messages
	const validMessages = useMemo(
		() => allMessages.filter((message) => message && message.id),
		[allMessages],
	);

	// ========== 5. Render ==========
	if (validMessages.length === 0) {
		return (
			<div className={styles.empty}>
				<div className={styles.logo}>π</div>
				<h1>Welcome to Pi Gateway</h1>
				<p>Start a conversation below</p>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			{validMessages.map((message) => (
				<MessageItem
					key={message.id}
					message={message}
					showThinking={showThinking}
					showTools={showTools}
					onToggleCollapse={() => onToggleMessageCollapse(message.id)}
					onToggleThinking={() => onToggleThinkingCollapse(message.id)}
					onToggleTools={() => onToggleToolsCollapse?.(message.id)}
					onDelete={() => onDeleteMessage?.(message.id)}
					onRegenerate={() => onRegenerateMessage?.(message.id)}
				/>
			))}
		</div>
	);
}
