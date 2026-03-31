/**
 * MessageItem - 重构版消息显示组件
 *
 * 特性:
 * 1. 完全独立的消息块 - 每种类型有自己的容器和样式
 * 2. 紧凑布局 - 减少内边距和间距
 * 3. 正确的溢出控制 - 防止内容撑破布局
 * 4. 统一的消息类型处理 - 支持从文件加载和流式消息
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

	// 分类消息内容 - 保持原始顺序
	const contentBlocks = useMemo(() => {
		return message.content.map((c, idx) => ({ ...c, originalIndex: idx }));
	}, [message.content]);

	// 提取各类内容
	const thinkingBlocks = contentBlocks.filter((c) => c.type === "thinking");
	const textBlocks = contentBlocks.filter((c) => c.type === "text");

	// 合并 tool 和 tool_use 块，避免重复显示
	// tool_use 是流式构建中的工具调用，tool 是已完成的工具执行
	// 如果同一个 toolCallId 同时存在 tool 和 tool_use，只保留 tool（完成的）
	const toolCallIds = new Set<string>();
	const allToolBlocks = contentBlocks.filter((c) => {
		if (c.type === "tool") {
			toolCallIds.add(c.toolCallId || "");
			return true;
		}
		if (c.type === "tool_use") {
			// 只保留还没有完成版本的 tool_use
			if (!toolCallIds.has(c.toolCallId || "")) {
				toolCallIds.add(c.toolCallId || "");
				return true;
			}
			return false;
		}
		return false;
	});

	// 调试日志 - 仅在开发环境显示
	if (process.env.NODE_ENV === "development") {
		console.log(
			"[MessageItem] Message:",
			message.id,
			"Role:",
			message.role,
			"Content types:",
			contentBlocks.map((c) => c.type),
			"mergedToolBlocks:",
			allToolBlocks.length,
		);
	}

	// 合并所有文本内容用于代码块解析
	const fullText = textBlocks.map((c) => c.text).join("");

	// 处理复制
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
			{/* 操作按钮 - 只显示复制和删除 */}
			<div
				className={styles.actions}
				style={{ opacity: showActions ? 1 : 0 }}
			>
				<button
					className={styles.actionBtn}
					onClick={handleCopy}
					title="复制"
				>
					📋
				</button>
				{onDelete && (
					<button
						className={styles.actionBtn}
						onClick={onDelete}
						title="删除"
					>
						🗑
					</button>
				)}
			</div>

			{/* Content Blocks - 按原始顺序渲染 */}
			{!isCollapsed && (
				<div className={styles.content}>
					{isUser ? (
						// 用户消息 - 带头像图标
						<UserContent text={fullText} />
					) : (
						// AI 消息 - 按类型分别渲染
						<AIContent
							message={message}
							thinkingBlocks={thinkingBlocks}
							toolBlocks={allToolBlocks}
							textBlocks={textBlocks}
							showThinking={showThinking}
							onToggleThinking={onToggleThinking}
							isStreaming={message.isStreaming}
						/>
					)}
				</div>
			)}
		</div>
	);
}

// 用户消息内容
function UserContent({ text }: { text: string }) {
	if (!text) return null;
	return (
		<div className={styles.userText}>
			<CompactMarkdown content={text} />
		</div>
	);
}

// 统一的图标组件




// 按轮次分组的内容块
interface TurnGroup {
	turnNumber: number;
	blocks: Array<MessageContent & { originalIndex: number }>;
}

// AI 消息内容 - 按轮次分组渲染
interface AIContentProps {
	message: Message;
	thinkingBlocks: Array<MessageContent & { originalIndex: number }>;
	toolBlocks: Array<MessageContent & { originalIndex: number }>;
	textBlocks: Array<MessageContent & { originalIndex: number }>;
	showThinking: boolean;
	onToggleThinking: () => void;
	isStreaming?: boolean;
}

function AIContent({
	message,
	thinkingBlocks,
	toolBlocks,
	textBlocks,
	showThinking,
	onToggleThinking,
	isStreaming,
}: AIContentProps) {
	// 按轮次分组所有块
	const turnGroups = useMemo(() => {
		// 合并所有块并保留原始索引
		const allBlocks = [
			...thinkingBlocks.map((b) => ({ ...b, blockType: "thinking" as const })),
			...textBlocks.map((b) => ({ ...b, blockType: "text" as const })),
			...toolBlocks.map((b) => ({ ...b, blockType: "tool" as const })),
		].sort((a, b) => a.originalIndex - b.originalIndex);

		// 按轮次分组
		const groups: TurnGroup[] = [];
		let currentGroup: TurnGroup = { turnNumber: 1, blocks: [] };

		for (const block of allBlocks) {
			if (block.type === "turn_marker") {
				// 如果有内容，保存当前组
				if (currentGroup.blocks.length > 0) {
					groups.push({ ...currentGroup });
				}
				// 开始新组
				currentGroup = {
					turnNumber: block.turnNumber || groups.length + 2,
					blocks: [],
				};
			} else {
				currentGroup.blocks.push(block);
			}
		}

		// 添加最后一组
		if (currentGroup.blocks.length > 0) {
			groups.push(currentGroup);
		}

		// 如果没有分组（没有turn_marker），返回一个包含所有块的分组
		if (groups.length === 0 && allBlocks.length > 0) {
			groups.push({ turnNumber: 1, blocks: allBlocks });
		}

		return groups;
	}, [thinkingBlocks, toolBlocks, textBlocks]);

	return (
		<div className={styles.aiContent}>
			{turnGroups.map((group, groupIdx) => (
				<div
					key={`turn-${group.turnNumber}`}
					className={styles.turnGroup}
					data-turn={group.turnNumber}
				>
					{/* 轮次分隔线（非第一轮时显示） */}
					{groupIdx > 0 && (
						<div className={styles.turnDivider}>
							<span className={styles.turnLabel}>Round {group.turnNumber}</span>
						</div>
					)}

					{/* 渲染该轮次的所有块 */}
					<div className={styles.turnContent}>
						{group.blocks.map((block, idx) => {
							switch (block.blockType) {
								case "thinking":
									return showThinking ? (
										<ThinkingBlock
											key={`thinking-${group.turnNumber}-${idx}`}
											content={block}
											isCollapsed={message.isThinkingCollapsed}
											onToggle={onToggleThinking}
											isFirst={idx === 0}
											isStreaming={isStreaming}
										/>
									) : null;
								case "tool":
									return (
										<ToolResultBlock
											key={`tool-${group.turnNumber}-${idx}`}
											content={block}
											isStreaming={isStreaming}
										/>
									);
								case "text":
									// 找到第一个文本块的索引
									const firstTextIdx = group.blocks.findIndex(b => b.blockType === "text");
									const isFirstText = idx === firstTextIdx;
									// 每轮最后一个文本块使用代码高亮
									const isLastText =
										idx === group.blocks.length - 1 && block.text;
									if (isLastText) {
										return (
											<div
												key={`text-${group.turnNumber}-${idx}`}
												className={styles.textSection}
											>
												
												<CompactMarkdownWithCode content={block.text} />
											</div>
										);
									}
									return block.text ? (
										<div
											key={`text-${group.turnNumber}-${idx}`}
											className={styles.textSection}
										>
											
											<CompactMarkdown content={block.text} />
										</div>
									) : null;
								default:
									return null;
							}
						})}
					</div>
				</div>
			))}
		</div>
	);
}

// Thinking 块组件
interface ThinkingBlockProps {
	content: MessageContent;
	isCollapsed?: boolean;
	onToggle: () => void;
	isFirst: boolean;
	isStreaming?: boolean;
}

function ThinkingBlock({
	content,
	isCollapsed,
	onToggle,
	isFirst,
	isStreaming,
}: ThinkingBlockProps) {
	// 流式时展开，非流式时默认折叠（除非用户手动展开）
	const shouldShow = isStreaming ? true : (isCollapsed === false);

	// 获取第一行内容
	const firstLine = content.thinking?.split('\n')[0] || '';

	return (
		<div className={styles.thinkingContainer} onClick={onToggle}>
			{shouldShow ? (
				<pre className={styles.thinkingBody}>
					{content.thinking || (
						<span style={{ opacity: 0.5 }}>(empty thinking content)</span>
					)}
				</pre>
			) : (
				<div className={styles.thinkingCollapsed}>
					
					<span className={styles.collapsedText}>{firstLine}</span>
				</div>
			)}
		</div>
	);
}

// Tool 结果块 (已完成执行)
interface ToolResultBlockProps {
	content: MessageContent;
	isStreaming?: boolean;
}

function ToolResultBlock({ content, isStreaming }: ToolResultBlockProps) {
	// 流式时展开，非流式时折叠（文件加载时默认折叠）
	const [userExpanded, setUserExpanded] = useState<boolean | null>(null);

	// 实际展开状态：流式时强制展开，否则使用用户设置或默认折叠
	const isExpanded = isStreaming ? true : (userExpanded ?? false);

	const status = content.error
		? "error"
		: content.output
			? "success"
			: "pending";

	const getStatusIcon = () => {
		switch (status) {
			case "success":
				return <span className={styles.statusSuccess}>●</span>;
			case "error":
				return <span className={styles.statusError}>●</span>;
			default:
				return <span className={styles.statusPending}>●</span>;
		}
	};

	// 获取第一行输出内容
	const outputText = content.output || content.error || "";
	const firstLine = typeof outputText === "string" 
		? outputText.split("\n")[0].substring(0, 80)
		: String(outputText).substring(0, 80);

	const safeStringify = (obj: unknown): string => {
		if (obj === null || obj === undefined) return "";
		if (typeof obj === "string") return obj;
		try {
			return JSON.stringify(obj, null, 2);
		} catch {
			return String(obj);
		}
	};

	// 将参数格式化为命令行样式
	const formatArgsAsCommand = (
		toolName: string,
		args: Record<string, unknown>,
	): string => {
		if (!args || Object.keys(args).length === 0) return toolName;

		const argStr = Object.entries(args)
			.map(([key, value]) => {
				const val = String(value);
				// 如果有空格、特殊字符或多行，用引号包裹
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

		return `${toolName} ${argStr}`;
	};

	return (
		<div 
			className={`${styles.toolContainer} ${styles[status]}`}
			onClick={() => setUserExpanded(!isExpanded)}
		>
			{isExpanded ? (
				<pre className={styles.toolCode}>
					{/* 命令部分 */}
					{content.args && Object.keys(content.args).length > 0 && (
						<div className={styles.commandLine}>
							<span className={styles.commandPrompt}>$</span>
							<span className={styles.commandText}>
								{formatArgsAsCommand(
									content.toolName || "tool",
									content.args,
								)}
							</span>
						</div>
					)}
					{/* 输出部分 */}
					{content.output && (
						<div
							style={{
								marginTop: content.args ? "8px" : "0",
								borderTop: content.args
									? "1px solid var(--border-color)"
									: "none",
								paddingTop: content.args ? "8px" : "0",
							}}
						>
							{safeStringify(content.output)}
						</div>
					)}
					{/* 错误部分 */}
					{content.error && (
						<div className={styles.errorText}>
							{safeStringify(content.error)}
						</div>
					)}
				</pre>
			) : (
				<div className={styles.toolCollapsed}>
					
					<span className={styles.collapsedText}>{content.toolName || "tool"}</span>
					<span className={styles.collapsedPreview}>{firstLine}</span>
				</div>
			)}
		</div>
	);
}

// Tool Use 块 (流式中)
function ToolUseBlock({ content }: { content: MessageContent }) {
	const [isExpanded, setIsExpanded] = useState(true);

	return (
		<div className={`${styles.toolContainer} ${styles.building}`}>
			<button
				className={styles.toolHeader}
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<span className={`${styles.toolStatus} ${styles.pulse}`}>◐</span>
				<span className={styles.toolName}>{content.toolName || "tool"}</span>
				<span className={styles.toolToggle}>{isExpanded ? "▲" : "▼"}</span>
			</button>
			{isExpanded && content.partialArgs && (
				<div className={styles.toolBody}>
					<pre className={styles.toolCode}>{content.partialArgs}</pre>
				</div>
			)}
		</div>
	);
}

// 紧凑的 Markdown 渲染器 (用户消息)
function CompactMarkdown({ content }: { content: string }) {
	const formatted = useMemo(() => {
		return formatMarkdown(content);
	}, [content]);

	return (
		<span
			className={styles.markdownText}
			dangerouslySetInnerHTML={{ __html: formatted }}
		/>
	);
}

// 带代码块的 Markdown 渲染器 (AI 消息)
function CompactMarkdownWithCode({ content }: { content: string }) {
	const parts = useMemo(() => {
		return parseContentWithCode(content);
	}, [content]);

	return (
		<div className={styles.textContainer}>
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
		</div>
	);
}

// 代码块组件
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

// ============================================================================
// 工具函数
// ============================================================================

interface ContentPart {
	type: "text" | "code";
	content: string;
	language?: string;
}

// 解析内容，分离代码块
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
		parts.push({
			type: "text",
			content: content.slice(lastIndex),
		});
	}

	return parts.length > 0 ? parts : [{ type: "text", content }];
}

// 格式化 Markdown
function formatMarkdown(content: string): string {
	if (!content) return "";

	return (
		content
			// 转义 HTML
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			// 粗体
			.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
			.replace(/__([^_]+)__/g, "<strong>$1</strong>")
			// 斜体
			.replace(/\*([^*]+)\*/g, "<em>$1</em>")
			.replace(/_([^_]+)_/g, "<em>$1</em>")
			// 行内代码
			.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
			// 链接
			.replace(
				/\[([^\]]+)\]\(([^)]+)\)/g,
				'<a href="$2" target="_blank" rel="noopener">$1</a>',
			)
	);
}

// 语法高亮
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

	let html = code
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	// 字符串
	html = html.replace(
		/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
		'<span class="token-string">$1</span>',
	);

	// 注释
	html = html.replace(
		/(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm,
		'<span class="token-comment">$1</span>',
	);

	// 数字
	html = html.replace(
		/\b(\d+\.?\d*)\b/g,
		'<span class="token-number">$1</span>',
	);

	// 关键字
	const keywordRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
	html = html.replace(keywordRegex, '<span class="token-keyword">$1</span>');

	return html;
}
