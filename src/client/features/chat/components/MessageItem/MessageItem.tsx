/**
 * MessageItem - 扁平化重构版
 */
import { useMemo, useState } from "react";
import type { Message, MessageContent } from "@/types/chat";
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

export function MessageItem({
	message,
	showThinking,
	showTools = true,
	onToggleCollapse,
	onToggleThinking,
	onToggleTools,
	onDelete,
}: MessageItemProps) {
	const isUser = message.role === "user";
	const isCollapsed = message.isMessageCollapsed ?? false;
	const [showActions, setShowActions] = useState(false);

	const blocks = useMemo(() => {
		return message.content.map((c, idx) => ({ ...c, originalIndex: idx }));
	}, [message.content]);

	const fullText = useMemo(() => {
		return blocks
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("");
	}, [blocks]);

	const handleCopy = () => {
		const text = message.content
			.map((c) => {
				if (c.type === "text") return c.text || "";
				if (c.type === "thinking") return c.thinking || "";
				if (c.type === "tool" || c.type === "tool_use") {
					return `[${c.toolName}] ${c.output || c.partialArgs || ""}`;
				}
				return "";
			})
			.filter(Boolean)
			.join("\n\n");
		navigator.clipboard.writeText(text);
	};

	return (
		<div
			className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}
			onMouseEnter={() => setShowActions(true)}
			onMouseLeave={() => setShowActions(false)}
		>
			<div className={styles.actions} style={{ opacity: showActions ? 1 : 0 }}>
				<button className={styles.actionBtn} onClick={handleCopy} title="复制">
					📋
				</button>
				{onDelete && (
					<button className={styles.actionBtn} onClick={onDelete} title="删除">
						🗑
					</button>
				)}
			</div>

			{!isCollapsed && (
				<>
					{isUser ? (
						<span
							className={styles.userText}
							dangerouslySetInnerHTML={{ __html: formatMarkdown(fullText) }}
						/>
					) : (
						blocks.map((block, idx) => {
							switch (block.type) {
								case "thinking":
									return showThinking ? (
										<ThinkingContent
											key={`thinking-${idx}`}
											content={block}
											isCollapsed={message.isThinkingCollapsed}
											onToggle={onToggleThinking}
											isStreaming={message.isStreaming}
										/>
									) : null;
								case "tool":
									return showTools ? (
										<ToolContent
											key={`tool-${block.toolCallId || idx}`}
											content={block}
											isCollapsed={message.isToolsCollapsed}
											onToggle={onToggleTools}
											isStreaming={message.isStreaming}
										/>
									) : null;
								case "tool_use":
									return showTools ? (
										<ToolUseContent
											key={`tool-use-${block.toolCallId || idx}`}
											content={block}
										/>
									) : null;
								case "text":
									return block.text ? (
										<TextContent key={`text-${idx}`} content={block.text} />
									) : null;
								default:
									return null;
							}
						})
					)}
				</>
			)}
		</div>
	);
}

// Thinking 块
interface ThinkingContentProps {
	content: MessageContent;
	isCollapsed?: boolean;
	onToggle?: () => void;
	isStreaming?: boolean;
}

function ThinkingContent({
	content,
	isCollapsed,
	onToggle,
	isStreaming,
}: ThinkingContentProps) {
	const shouldShow = isStreaming ? true : isCollapsed === false;
	const firstLine = content.thinking?.split("\n")[0] || "";

	if (!shouldShow) {
		return (
			<div className={styles.thinkingCollapsed} onClick={onToggle}>
				<span className={styles.collapsedText}>{firstLine}</span>
			</div>
		);
	}

	return (
		<pre className={styles.thinkingBody} onClick={onToggle}>
			{content.thinking || (
				<span style={{ opacity: 0.5 }}>(empty thinking content)</span>
			)}
		</pre>
	);
}

// Tool 块
interface ToolContentProps {
	content: MessageContent;
	isCollapsed?: boolean;
	onToggle?: () => void;
	isStreaming?: boolean;
}

function ToolContent({
	content,
	isCollapsed,
	onToggle,
	isStreaming,
}: ToolContentProps) {
	const isExpanded = isStreaming ? true : isCollapsed === false;
	const status = content.error
		? "error"
		: content.output
			? "success"
			: "pending";

	const toolArgs = useMemo(() => {
		if (content.args && Object.keys(content.args).length > 0) {
			const streamingArgs = (content.args as Record<string, unknown>)
				._streamingArgs;
			if (streamingArgs && typeof streamingArgs === "string") {
				try {
					return JSON.parse(streamingArgs);
				} catch {
					const matches = streamingArgs.match(/(\w+)=([^\s,]+)/g);
					if (matches) {
						const parsed: Record<string, string> = {};
						matches.forEach((match) => {
							const [key, value] = match.split("=");
							if (key && value) {
								parsed[key] = value.replace(/^["']|["']$/g, "");
							}
						});
						return Object.keys(parsed).length > 0
							? parsed
							: { _raw: streamingArgs };
					}
					return { _raw: streamingArgs };
				}
			}
			const { _streamingArgs, ...restArgs } = content.args as Record<
				string,
				unknown
			>;
			return Object.keys(restArgs).length > 0 ? restArgs : {};
		}
		return {};
	}, [content.args]);

	const previewLine = useMemo(() => {
		const toolName = content.toolName || "tool";
		const argsStr = formatArgsAsCommand(toolName, toolArgs);
		const fullCmd = argsStr || toolName;
		return fullCmd.split("\n")[0].substring(0, 60);
	}, [content.toolName, toolArgs]);

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onToggle?.();
	};

	if (!isExpanded) {
		return (
			<div
				className={`${styles.toolContainer} ${styles[status]} ${styles.collapsed}`}
				onClick={handleClick}
				title={previewLine}
			>
				<span className={styles.collapsedIcon}>
					{status === "success" ? "✓" : status === "error" ? "✗" : "◐"}
				</span>
				<span className={styles.collapsedText}>{content.toolName}</span>
				<span className={styles.collapsedPreview}>{previewLine}</span>
			</div>
		);
	}

	return (
		<div
			className={`${styles.toolContainer} ${styles[status]}`}
			onClick={handleClick}
		>
			{Object.keys(toolArgs).length > 0 && (
				<div className={styles.commandLine}>
					<span className={styles.commandPrompt}>$</span>
					<span className={styles.commandText}>
						{formatArgsAsCommand(content.toolName || "tool", toolArgs)}
					</span>
				</div>
			)}
			{content.output && (
				<pre className={styles.toolOutputPre}>
					{safeStringify(content.output)}
				</pre>
			)}
			{content.error && (
				<pre className={`${styles.toolOutputPre} ${styles.errorText}`}>
					{safeStringify(content.error)}
				</pre>
			)}
		</div>
	);
}

// Tool Use 块
function ToolUseContent({ content }: { content: MessageContent }) {
	return (
		<div className={`${styles.toolContainer} ${styles.building}`}>
			<div className={styles.commandLine}>
				<span className={`${styles.toolStatus} ${styles.pulse}`}>◐</span>
				<span className={styles.commandText}>
					{content.toolName || "tool"}
					{content.partialArgs ? `: ${content.partialArgs}` : ""}
				</span>
			</div>
		</div>
	);
}

// Text 块
function TextContent({ content }: { content: string }) {
	const parts = useMemo(() => parseContentWithCode(content), [content]);

	if (parts.length === 1 && parts[0].type === "text") {
		return (
			<span
				className={styles.markdownText}
				dangerouslySetInnerHTML={{ __html: formatMarkdown(parts[0].content) }}
			/>
		);
	}

	return (
		<>
			{parts.map((part, idx) =>
				part.type === "code" ? (
					<CodeBlock key={idx} code={part.content} language={part.language} />
				) : (
					<span
						key={idx}
						className={styles.markdownText}
						dangerouslySetInnerHTML={{
							__html: formatMarkdown(part.content),
						}}
					/>
				),
			)}
		</>
	);
}

// 代码块
function CodeBlock({ code, language }: { code: string; language?: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const highlightedCode = useMemo(() => highlightCode(code), [code]);

	return (
		<div className={styles.codeContainer}>
			<div className={styles.codeHeader}>
				<span className={styles.codeLang}>{language || "text"}</span>
				<button className={styles.codeCopyBtn} onClick={handleCopy}>
					{copied ? "✓" : "📋"}
				</button>
			</div>
			<pre className={styles.codePre}>
				<code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
			</pre>
		</div>
	);
}

// 工具函数
interface ContentPart {
	type: "text" | "code";
	content: string;
	language?: string;
}

function parseContentWithCode(content: string): ContentPart[] {
	if (!content) return [];

	const parts: ContentPart[] = [];
	const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = codeBlockRegex.exec(content)) !== null) {
		if (match.index > lastIndex) {
			parts.push({
				type: "text",
				content: content.slice(lastIndex, match.index),
			});
		}
		parts.push({
			type: "code",
			language: match[1] || "text",
			content: match[2].trim(),
		});
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < content.length) {
		parts.push({ type: "text", content: content.slice(lastIndex) });
	}

	return parts.length > 0 ? parts : [{ type: "text", content }];
}

function formatMarkdown(content: string): string {
	if (!content) return "";
	return content
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/__([^_]+)__/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>")
		.replace(/_([^_]+)_/g, "<em>$1</em>")
		.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
		.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener">$1</a>',
		);
}

function highlightCode(code: string): string {
	if (!code) return "";
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
	];

	let html = code
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	html = html.replace(
		/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
		'<span class="token-string">$1</span>',
	);
	html = html.replace(
		/(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm,
		'<span class="token-comment">$1</span>',
	);
	html = html.replace(
		/\b(\d+\.?\d*)\b/g,
		'<span class="token-number">$1</span>',
	);
	const keywordRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
	html = html.replace(keywordRegex, '<span class="token-keyword">$1</span>');

	return html;
}

function safeStringify(obj: unknown): string {
	if (obj === null || obj === undefined) return "";
	if (typeof obj === "string") return obj;
	try {
		return JSON.stringify(obj, null, 2);
	} catch {
		return String(obj);
	}
}

function formatArgsAsCommand(
	toolName: string,
	args: Record<string, unknown>,
): string {
	if (!args || Object.keys(args).length === 0) return toolName;

	if (args._raw && typeof args._raw === "string") {
		return `${toolName} ${args._raw}`;
	}

	const argStr = Object.entries(args)
		.filter(([key]) => !key.startsWith("_"))
		.map(([key, value]) => {
			const val = String(value);
			if (
				val.includes(" ") ||
				val.includes('"') ||
				val.includes("\n") ||
				val.includes("\t")
			) {
				return `${key}="${val.replace(/"/g, '\\"')}"`;
			}
			return `${key}=${val}`;
		})
		.join(" ");
	return argStr ? `${toolName} ${argStr}` : toolName;
}
