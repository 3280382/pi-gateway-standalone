/**
 * MessageItem - Display different message types with distinct styles
 * Supports markdown, code highlighting, thinking blocks, and tool calls
 */

import { useMemo, useState } from "react";
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

	// Process text content to extract code blocks
	interface ContentPart {
		type: "text" | "code";
		content: string;
		language?: string;
	}

	const processedContent = useMemo<ContentPart[]>(() => {
		if (!textContent?.text) return [];

		const parts: ContentPart[] = [];
		const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = codeBlockRegex.exec(textContent.text)) !== null) {
			// Add text before code block
			if (match.index > lastIndex) {
				parts.push({
					type: "text",
					content: textContent.text.slice(lastIndex, match.index),
				});
			}

			// Add code block
			parts.push({
				type: "code",
				language: match[1] || "text",
				content: match[2].trim(),
			});

			lastIndex = match.index + match[0].length;
		}

		// Add remaining text
		if (lastIndex < textContent.text.length) {
			parts.push({
				type: "text",
				content: textContent.text.slice(lastIndex),
			});
		}

		return parts.length > 0
			? parts
			: [{ type: "text", content: textContent.text }];
	}, [textContent?.text]);

	return (
		<div
			className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}
			onMouseEnter={() => setShowActions(true)}
			onMouseLeave={() => setShowActions(false)}
		>
			{/* Header */}
			<div className={styles.header}>
				<span className={styles.roleIcon}>{isUser ? "👤" : "π"}</span>
				<div
					className={styles.actions}
					style={{ opacity: showActions ? 1 : 0 }}
				>
					{onRegenerate && !isUser && (
						<button
							className={styles.actionBtn}
							onClick={onRegenerate}
							title="Regenerate"
						>
							↻
						</button>
					)}
					<button
						className={styles.actionBtn}
						onClick={handleCopy}
						title="Copy"
					>
						📋
					</button>
					{onDelete && (
						<button
							className={styles.actionBtn}
							onClick={onDelete}
							title="Delete"
						>
							🗑
						</button>
					)}
					<button
						className={styles.actionBtn}
						onClick={onToggleCollapse}
						title={isCollapsed ? "Expand" : "Collapse"}
					>
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

							{/* AI text with code highlighting */}
							{processedContent.length > 0 && (
								<div className={styles.text}>
									{processedContent.map((part, idx) =>
										part.type === "code" ? (
											<CodeBlock
												key={idx}
												code={part.content}
												language={part.language || "text"}
											/>
										) : (
											<MarkdownText key={idx} content={part.content} />
										),
									)}
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);

	function handleCopy() {
		const text = message.content
			.map((c) => c.text || c.thinking || "")
			.filter(Boolean)
			.join("\n");
		navigator.clipboard.writeText(text);
	}
}

// Code block component
function CodeBlock({ code, language }: { code: string; language: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Simple syntax highlighting for common keywords
	const highlightedCode = useMemo(() => {
		const keywords = [
			"const",
			"let",
			"var",
			"function",
			"return",
			"if",
			"else",
			"for",
			"while",
			"import",
			"export",
			"from",
			"class",
			"interface",
			"type",
			"async",
			"await",
			"try",
			"catch",
			"throw",
			"new",
			"this",
			"true",
			"false",
			"null",
			"undefined",
			"def",
			"print",
			"in",
			"range",
			"len",
			"self",
			"pass",
			"break",
			"continue",
		];
		const comments = /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm;
		const strings = /(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/g;
		const numbers = /\b\d+\.?\d*\b/g;

		let html = code
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		// Highlight strings
		html = html.replace(strings, "<span class={styles.string}>$&</span>");

		// Highlight comments
		html = html.replace(comments, "<span class={styles.comment}>$&</span>");

		// Highlight numbers
		html = html.replace(numbers, "<span class={styles.number}>$&</span>");

		// Highlight keywords
		const keywordRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
		html = html.replace(keywordRegex, "<span class={styles.keyword}>$1</span>");

		return html;
	}, [code]);

	return (
		<div className={styles.codeBlock}>
			<div className={styles.codeHeader}>
				<span className={styles.codeLang}>{language}</span>
				<button className={styles.copyBtn} onClick={handleCopy}>
					{copied ? "✓ Copied" : "Copy"}
				</button>
			</div>
			<pre className={styles.codeContent}>
				<code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
			</pre>
		</div>
	);
}

// Simple markdown text renderer
function MarkdownText({ content }: { content: string }) {
	// Handle inline code
	const parts = content.split(/(`[^`]+`)/g);

	return (
		<span className={styles.markdownText}>
			{parts.map((part, idx) => {
				if (part.startsWith("`") && part.endsWith("`")) {
					return (
						<code key={idx} className={styles.inlineCode}>
							{part.slice(1, -1)}
						</code>
					);
				}
				// Handle bold and italic
				const formatted = part
					.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
					.replace(/\*([^*]+)\*/g, "<em>$1</em>")
					.replace(/__([^_]+)__/g, "<strong>$1</strong>")
					.replace(/_([^_]+)_/g, "<em>$1</em>");
				return (
					<span key={idx} dangerouslySetInnerHTML={{ __html: formatted }} />
				);
			})}
		</span>
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
