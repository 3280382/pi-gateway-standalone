/**
 * MessageList - Scrollable message container
 */

import { useEffect, useRef } from "react";
import type { Message } from "@/types/chat";
import { MessageItem } from "../MessageItem/MessageItem";
import styles from "./MessageList.module.css";

interface MessageListProps {
	messages: Message[];
	currentStreamingMessage: Message | null;
	showThinking: boolean;
	onToggleMessageCollapse: (id: string) => void;
	onToggleThinkingCollapse: (id: string) => void;
	onDeleteMessage?: (id: string) => void;
	onRegenerateMessage?: (id: string) => void;
}

export function MessageList({
	messages,
	currentStreamingMessage,
	showThinking,
	onToggleMessageCollapse,
	onToggleThinkingCollapse,
	onDeleteMessage,
	onRegenerateMessage,
}: MessageListProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const userScrolledRef = useRef(false);

	const allMessages = currentStreamingMessage
		? [...messages, currentStreamingMessage]
		: messages;

	// Auto-scroll to bottom
	useEffect(() => {
		const container = containerRef.current;
		if (!container || userScrolledRef.current) return;
		container.scrollTop = container.scrollHeight;
	}, [allMessages.length, currentStreamingMessage?.id]);

	const handleScroll = () => {
		const container = containerRef.current;
		if (!container) return;
		const { scrollTop, scrollHeight, clientHeight } = container;
		userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 50;
	};

	if (allMessages.length === 0) {
		return (
			<div className={styles.empty}>
				<div className={styles.logo}>π</div>
				<h1>Welcome to Pi Gateway</h1>
				<p>Start a conversation below</p>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={styles.container}
			onScroll={handleScroll}
		>
			{allMessages.map((message) => (
				<MessageItem
					key={message.id}
					message={message}
					showThinking={showThinking}
					onToggleCollapse={() => onToggleMessageCollapse(message.id)}
					onToggleThinking={() => onToggleThinkingCollapse(message.id)}
					onDelete={() => onDeleteMessage?.(message.id)}
					onRegenerate={() => onRegenerateMessage?.(message.id)}
				/>
			))}
		</div>
	);
}
