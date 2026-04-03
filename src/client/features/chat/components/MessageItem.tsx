/**
 * MessageItem - Neo Glassmorphism Edition
 */
import { memo, useMemo, useState } from "react";
import type { Message, MessageContent } from "@/features/chat/types/chat";
import styles from "./MessageItem.module.css";

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

// Helper to safely convert any value to string
function safeString(val: unknown): string {
	if (val === null || val === undefined) return "";
	if (typeof val === "string") return val;
	if (typeof val === "object") {
		// If it has a content property, use that
		if (val && "content" in val && typeof (val as Record<string, unknown>).content === "string") {
			return (val as Record<string, string>).content;
		}
		return JSON.stringify(val, null, 2);
	}
	return String(val);
}

export const MessageItem = memo(
	function MessageItem({
		message,
		showThinking,
		showTools = true,
	}: MessageItemProps) {
		const isUser = message.role === "user";

		const blocks = useMemo(() => {
			return message.content.map((c, idx) => ({ ...c, originalIndex: idx }));
		}, [message.content]);

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
						showTools={showTools}
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
			prevProps.showTools === nextProps.showTools &&
			JSON.stringify(prevProps.message.content) ===
				JSON.stringify(nextProps.message.content)
		);
	},
);

interface GlassCardProps {
	block: MessageContent & { originalIndex?: number };
	isStreaming: boolean;
	showThinking: boolean;
	showTools: boolean;
}

function GlassCard({
	block,
	isStreaming,
	showThinking,
	showTools,
}: GlassCardProps) {
	const [isExpanded, setIsExpanded] = useState(isStreaming);
	const [showCopy, setShowCopy] = useState(false);

	useMemo(() => {
		if (!isStreaming && block.type !== "text") {
			setIsExpanded(false);
		}
	}, [isStreaming, block.type]);

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
	};

	switch (block.type) {
		case "thinking":
			if (!showThinking) return null;
			const thinkingText = safeString(block.thinking);
			return (
				<div
					className={`${styles.card} ${styles.thinking}`}
					onMouseEnter={() => setShowCopy(true)}
					onMouseLeave={() => setShowCopy(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} style={{ background: "#fbbf24" }} />
						<span className={styles.label}>Thinking</span>
						<div className={styles.actions}>
							{showCopy && (
								<button
									className={styles.btn}
									onClick={() => copyToClipboard(thinkingText)}
								>
									📋
								</button>
								)}
							<button
								className={styles.btn}
								onClick={() => setIsExpanded(!isExpanded)}
							>
								{isExpanded ? "▼" : "▶"}
							</button>
						</div>
					</div>
					{isExpanded && (
						<div className={styles.content}>
							<code>{thinkingText}</code>
						</div>
					)}
				</div>
			);

		case "tool_use":
			if (!showTools) return null;
			const toolArgs = block.partialArgs || JSON.stringify(block.args, null, 2);
			return (
				<div
					className={`${styles.card} ${styles.tool}`}
					onMouseEnter={() => setShowCopy(true)}
					onMouseLeave={() => setShowCopy(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} style={{ background: "#34d399" }} />
						<span className={styles.label}>{block.toolName}</span>
						<span className={styles.chip}>running</span>
						<div className={styles.actions}>
							{showCopy && (
								<button
									className={styles.btn}
									onClick={() => copyToClipboard(toolArgs)}
								>
									📋
								</button>
								)}
							<button
								className={styles.btn}
								onClick={() => setIsExpanded(!isExpanded)}
							>
								{isExpanded ? "▼" : "▶"}
							</button>
						</div>
					</div>
					{isExpanded && (
						<div className={styles.content}>
							<code>{toolArgs}</code>
						</div>
					)}
				</div>
			);

		case "tool":
			if (!showTools) return null;
			const status = block.error ? "error" : block.output ? "success" : "pending";
			const statusColor = block.error ? "#ef4444" : block.output ? "#10b981" : "#6b7280";
			const toolContent = safeString(block.output || block.error || "Processing...");
			return (
				<div
					className={`${styles.card} ${styles.tool}`}
					onMouseEnter={() => setShowCopy(true)}
					onMouseLeave={() => setShowCopy(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} style={{ background: statusColor }} />
						<span className={styles.label}>{block.toolName}</span>
						<span className={styles.chip}>{status}</span>
						<div className={styles.actions}>
							{showCopy && (
								<button
									className={styles.btn}
									onClick={() => copyToClipboard(toolContent)}
								>
									📋
								</button>
								)}
							<button
								className={styles.btn}
								onClick={() => setIsExpanded(!isExpanded)}
							>
								{isExpanded ? "▼" : "▶"}
							</button>
						</div>
					</div>
					{isExpanded && (
						<div className={styles.content}>
							<code>{toolContent}</code>
						</div>
					)}
				</div>
			);

		case "text":
			if (!block.text) return null;
			return (
				<div
					className={`${styles.card} ${styles.output}`}
					onMouseEnter={() => setShowCopy(true)}
					onMouseLeave={() => setShowCopy(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} style={{ background: "#22d3ee" }} />
						<span className={styles.label}>Assistant</span>
						<div className={styles.actions}>
							{showCopy && (
								<button
									className={styles.btn}
									onClick={() => copyToClipboard(block.text || "")}
								>
									📋
								</button>
								)}
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

// Safe text rendering component
function TextContent({ text }: { text: string }) {
	const lines = text.split('\n');
	return (
		<>
			{lines.map((line, idx) => {
				// Handle code blocks
				if (line.startsWith('```')) {
					return <div key={idx} className={styles.codeBlockStart}>{line}</div>;
				}
				// Handle inline code
				const parts = line.split(/(`[^`]+`)/g);
				return (
					<div key={idx} className={styles.line}>
						{parts.map((part, pidx) => {
							if (part.startsWith('`') && part.endsWith('`')) {
								return <code key={pidx} className={styles.inlineCode}>{part.slice(1, -1)}</code>;
							}
							// Handle bold
							const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
							return boldParts.map((bp, bidx) => {
								if (bp.startsWith('**') && bp.endsWith('**')) {
									return <strong key={`${pidx}-${bidx}`}>{bp.slice(2, -2)}</strong>;
								}
								// Handle italic
								const italicParts = bp.split(/(\*[^*]+\*)/g);
								return italicParts.map((ip, iidx) => {
									if (ip.startsWith('*') && ip.endsWith('*') && !ip.startsWith('**')) {
										return <em key={`${pidx}-${bidx}-${iidx}`}>{ip.slice(1, -1)}</em>;
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
