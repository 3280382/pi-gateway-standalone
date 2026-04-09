/**
 * MessageItem - Individual message rendering component
 *
 * 职责：
 * - 渲染单条消息（用户或AI）
 * - 处理消息内容的块级渲染（thinking, tool_use, tool, text）
 * - 不包含业务逻辑
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { Message, MessageContent } from "@/features/chat/types/chat";
import styles from "./MessageItem.module.css";

// ============================================================================
// Types
// ============================================================================

interface MessageItemProps {
	message: Message;
	showThinking: boolean;
	showTools?: boolean;
	onToggleCollapse: () => void;
	onToggleThinking: () => void;
	onToggleTools?: () => void;
	onDelete?: () => void;
	onRegenerate?: () => void;
}

interface GlassCardProps {
	block: MessageContent & { originalIndex?: number };
	isStreaming?: boolean;
	showThinking: boolean;
	showTools?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function safeString(val: unknown): string {
	if (val === null || val === undefined) return "";
	if (typeof val === "string") return val;
	if (typeof val === "object") {
		if (
			val &&
			"content" in val &&
			typeof (val as Record<string, unknown>).content === "string"
		) {
			return (val as Record<string, string>).content;
		}
		return JSON.stringify(val, null, 2);
	}
	return String(val);
}

// ============================================================================
// Component
// ============================================================================

export const MessageItem = memo(
	function MessageItem({
		message,
		showThinking,
		showTools = true,
	}: MessageItemProps) {
		// ========== 4. Computed ==========
		const isUser = message.role === "user";

		const blocks = useMemo(() => {
			if (!message.content || !Array.isArray(message.content)) return [];
			return message.content.map((c, idx) => ({ ...c, originalIndex: idx }));
		}, [message.content]);

		// ========== 5. Render ==========
		if (isUser) {
			const text = blocks
				.filter((c) => c.type === "text")
				.map((c) => c.text)
				.join("");
			return (
				<div className={styles.userMessage}>
					<div className={styles.userBubble}>{text}</div>
				</div>
			);
		}

		return (
			<div className={styles.aiContainer}>
				{blocks.map((block, idx) => (
					<GlassCard
						key={`${block.type}-${idx}`}
						block={block}
						isStreaming={message.isStreaming}
						showThinking={showThinking}
						showTools={showTools ?? true}
					/>
				))}
			</div>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.message.id === nextProps.message.id &&
			prevProps.message.isStreaming === nextProps.message.isStreaming &&
			prevProps.showThinking === nextProps.showThinking &&
			(prevProps.showTools ?? true) === (nextProps.showTools ?? true) &&
			JSON.stringify(prevProps.message.content || []) ===
				JSON.stringify(nextProps.message.content || [])
		);
	},
);

function GlassCard({
	block,
	isStreaming = false,
	showThinking,
	showTools = true,
}: GlassCardProps) {
	// ========== 1. State ==========
	const [isExpanded, setIsExpanded] = useState(isStreaming);
	const [isCopyVisible, setIsCopyVisible] = useState(false);

	// ========== 2. Effects ==========
	// Collapse card when streaming ends (for non-text blocks)
	useEffect(() => {
		if (!isStreaming && block.type !== "text") {
			setIsExpanded(false);
		}
	}, [isStreaming, block.type]);

	// ========== 3. Actions ==========
	const toggleExpand = useCallback(() => {
		if (block.type !== "text") {
			setIsExpanded((prev) => !prev);
		}
	}, [block.type]);

	const copyToClipboard = useCallback((text: string) => {
		navigator.clipboard.writeText(text);
	}, []);

	switch (block.type) {
		case "thinking": {
			if (!showThinking) return null;
			const thinkingText = safeString(block.thinking);
			return (
				<div
					className={`${styles.card} ${styles.thinking}`}
					onClick={toggleExpand}
					onMouseEnter={() => setIsCopyVisible(true)}
					onMouseLeave={() => setIsCopyVisible(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} />
						<span className={styles.label}>Thinking</span>
						<div className={styles.actions}>
							<button
								className={styles.btnCopy}
								style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
								onClick={(e) => {
									e.stopPropagation();
									copyToClipboard(thinkingText);
								}}
							>
								📋
							</button>
							<span className={styles.toggleIcon}>
								{isExpanded ? "-" : "+"}
							</span>
						</div>
					</div>
					{isExpanded && (
						<div
							className={styles.content}
							onClick={(e) => e.stopPropagation()}
						>
							<code>{thinkingText}</code>
						</div>
					)}
				</div>
			);
		}

		case "tool_use": {
			if (!showTools) return null;
			const toolArgs = block.partialArgs || JSON.stringify(block.args, null, 2);
			return (
				<div
					className={`${styles.card} ${styles.toolUse}`}
					onClick={toggleExpand}
					onMouseEnter={() => setIsCopyVisible(true)}
					onMouseLeave={() => setIsCopyVisible(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} />
						<span className={styles.label}>{block.toolName}</span>
						<span className={styles.chip}>running</span>
						<div className={styles.actions}>
							<button
								className={styles.btnCopy}
								style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
								onClick={(e) => {
									e.stopPropagation();
									copyToClipboard(toolArgs);
								}}
							>
								📋
							</button>
							<span className={styles.toggleIcon}>
								{isExpanded ? "-" : "+"}
							</span>
						</div>
					</div>
					{isExpanded && (
						<div
							className={styles.content}
							onClick={(e) => e.stopPropagation()}
						>
							<code>{toolArgs}</code>
						</div>
					)}
				</div>
			);
		}

		case "tool": {
			if (!showTools) return null;
			const status = block.error
				? "error"
				: block.output
					? "success"
					: "pending";
			const toolContent = safeString(
				block.output || block.error || "Processing...",
			);
			return (
				<div
					className={`${styles.card} ${styles.toolResult}`}
					onClick={toggleExpand}
					onMouseEnter={() => setIsCopyVisible(true)}
					onMouseLeave={() => setIsCopyVisible(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} />
						<span className={styles.label}>{block.toolName}</span>
						<span className={`${styles.chip} ${styles[status]}`}>{status}</span>
						<div className={styles.actions}>
							<button
								className={styles.btnCopy}
								style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
								onClick={(e) => {
									e.stopPropagation();
									copyToClipboard(toolContent);
								}}
							>
								📋
							</button>
							<span className={styles.toggleIcon}>
								{isExpanded ? "-" : "+"}
							</span>
						</div>
					</div>
					{isExpanded && (
						<div
							className={styles.content}
							onClick={(e) => e.stopPropagation()}
						>
							<code>{toolContent}</code>
						</div>
					)}
				</div>
			);
		}

		case "text":
			if (!block.text) return null;
			return (
				<div
					className={`${styles.card} ${styles.output}`}
					onMouseEnter={() => setIsCopyVisible(true)}
					onMouseLeave={() => setIsCopyVisible(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} />
						<span className={styles.label}>Assistant</span>
						<div className={styles.actions}>
							<button
								className={styles.btnCopy}
								style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
								onClick={(e) => {
									e.stopPropagation();
									copyToClipboard(block.text || "");
								}}
							>
								📋
							</button>
						</div>
					</div>
					<div className={styles.content}>
						<TextContent text={block.text} />
					</div>
				</div>
			);

		default:
			return null;
	}
}

function TextContent({ text }: { text: string }) {
	const safeText = text || "";
	const lines = safeText.split("\n");
	return (
		<>
			{lines.map((line, idx) => {
				if (line.startsWith("```")) {
					return (
						<div key={idx} className={styles.codeBlockStart}>
							{line}
						</div>
					);
				}
				const parts = line.split(/(`[^`]+`)/g);
				return (
					<div key={idx} className={styles.line}>
						{parts.map((part, pidx) => {
							if (part.startsWith("`") && part.endsWith("`")) {
								return (
									<code key={pidx} className={styles.inlineCode}>
										{part.slice(1, -1)}
									</code>
								);
							}
							const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
							return boldParts.map((bp, bidx) => {
								if (bp.startsWith("**") && bp.endsWith("**")) {
									return (
										<strong key={`${pidx}-${bidx}`}>{bp.slice(2, -2)}</strong>
									);
								}
								const italicParts = bp.split(/(\*[^*]+\*)/g);
								return italicParts.map((ip, iidx) => {
									if (
										ip.startsWith("*") &&
										ip.endsWith("*") &&
										!ip.startsWith("**")
									) {
										return (
											<em key={`${pidx}-${bidx}-${iidx}`}>{ip.slice(1, -1)}</em>
										);
									}
									return <span key={`${pidx}-${bidx}-${iidx}`}>{ip}</span>;
								});
							});
						})}
					</div>
				);
			})}
		</>
	);
}
