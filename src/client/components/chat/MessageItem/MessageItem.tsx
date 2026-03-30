/**
 * MessageItem - Display different message types with distinct styles
 */

import { useState } from "react";
import type { Message, MessageContent } from "@/types/chat";
import styles from "./MessageItem.module.css";

interface MessageItemProps {
	message: Message;
	showThinking: boolean;
	onToggleCollapse: () => void;
	onToggleThinking: () => void;
	onDelete?: () => void;
	onRegenerate?: () => void;
}

export function MessageItem({
	message,
	showThinking,
	onToggleCollapse,
	onToggleThinking,
	onDelete,
	onRegenerate,
}: MessageItemProps) {
	const isUser = message.role === "user";
	const isCollapsed = message.isMessageCollapsed ?? false;
	const [showActions, setShowActions] = useState(false);

	const thinkingContent = message.content.find((c) => c.type === "thinking");
	const textContent = message.content.find((c) => c.type === "text");
	const toolContent = message.content.filter((c) => c.type === "tool");

	return (
		<div
			className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}
			onMouseEnter={() => setShowActions(true)}
			onMouseLeave={() => setShowActions(false)}
		>
			{/* Header */}
			<div className={styles.header}>
				<span className={styles.roleIcon}>{isUser ? "👤" : "π"}</span>
				<span className={styles.role}>{isUser ? "You" : "AI"}</span>
				<span className={styles.time}>{formatTime(message.timestamp)}</span>
				<div
					className={styles.actions}
					style={{ opacity: showActions ? 1 : 0 }}
				>
					{onRegenerate && !isUser && (
						<button className={styles.actionBtn} onClick={onRegenerate}>
							↻
						</button>
					)}
					{onDelete && (
						<button className={styles.actionBtn} onClick={onDelete}>
							🗑
						</button>
					)}
					<button className={styles.actionBtn} onClick={onToggleCollapse}>
						{isCollapsed ? "+" : "−"}
					</button>
				</div>
			</div>

			{/* Content */}
			{!isCollapsed && (
				<div className={styles.content}>
					{/* User text */}
					{isUser && textContent?.text && (
						<div className={styles.text}>{textContent.text}</div>
					)}

					{/* AI content */}
					{!isUser && (
						<>
							{/* Thinking */}
							{showThinking && thinkingContent && (
								<ThinkingBlock
									content={thinkingContent}
									isCollapsed={message.isThinkingCollapsed}
									onToggle={onToggleThinking}
								/>
							)}

							{/* Tools */}
							{toolContent.length > 0 && (
								<div className={styles.tools}>
									{toolContent.map((tool, idx) => (
										<ToolBlock key={idx} content={tool} />
									))}
								</div>
							)}

							{/* AI text */}
							{textContent?.text && (
								<div className={styles.text}>{textContent.text}</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

function ThinkingBlock({
	content,
	isCollapsed,
	onToggle,
}: {
	content: MessageContent;
	isCollapsed?: boolean;
	onToggle: () => void;
}) {
	return (
		<div className={styles.thinkingBlock}>
			<button className={styles.thinkingHeader} onClick={onToggle}>
				<span>💭 Thinking</span>
				<span>{isCollapsed ? "▼" : "▲"}</span>
			</button>
			{!isCollapsed && content.thinking && (
				<pre className={styles.thinkingContent}>{content.thinking}</pre>
			)}
		</div>
	);
}

function ToolBlock({ content }: { content: MessageContent }) {
	const [isExpanded, setIsExpanded] = useState(true);
	const status = content.error
		? "error"
		: content.output
			? "success"
			: "executing";

	return (
		<div className={`${styles.toolBlock} ${styles[status]}`}>
			<button
				className={styles.toolHeader}
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<span>
					{status === "success" ? "✓" : status === "error" ? "✗" : "◐"}
				</span>
				<span className={styles.toolName}>{content.toolName}</span>
				<span>{isExpanded ? "▲" : "▼"}</span>
			</button>
			{isExpanded && (
				<div className={styles.toolContent}>
					{content.args && Object.keys(content.args).length > 0 && (
						<pre className={styles.code}>
							{JSON.stringify(content.args, null, 2)}
						</pre>
					)}
					{content.output && (
						<pre className={styles.code}>{content.output}</pre>
					)}
					{content.error && (
						<pre className={`${styles.code} ${styles.errorText}`}>
							{content.error}
						</pre>
					)}
				</div>
			)}
		</div>
	);
}

function formatTime(date: Date): string {
	return new Date(date).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}
