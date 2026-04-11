/**
 * MessageItem - Individual message rendering component
 *
 * 职责：
 * - 渲染单条消息（用户或AI）
 * - 处理消息内容的块级渲染（thinking, tool_use, tool, text）
 * - 将 tool_use 和 tool 结果合并为一个完整的工具调用卡片
 * - 不包含业务逻辑
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// 内容块类型（带原始索引）
interface IndexedContentBlock extends MessageContent {
	originalIndex: number;
}

interface GlassCardProps {
	block: IndexedContentBlock;
	isStreaming?: boolean;
	isNewMessage?: boolean; // true=流式消息(默认展开), false=历史消息(思考/工具默认折叠)
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

/**
 * 解析工具参数，提取关键信息用于顶部显示
 */
function parseToolSummary(toolName: string, args: string | undefined): string {
	if (!args) return "";

	try {
		const parsed = JSON.parse(args);

		// 文件写入类工具 - 显示文件路径
		if (
			["write_file", "create_file", "edit_file", "apply_diff"].includes(
				toolName,
			)
		) {
			const path =
				parsed.path || parsed.file_path || parsed.filepath || parsed.filePath;
			if (path) {
				// 简化路径显示
				const shortPath = path.split("/").pop() || path;
				return `→ ${shortPath}`;
			}
		}

		// bash 命令 - 显示命令前20字符
		if (toolName === "bash" && parsed.command) {
			const cmd = parsed.command.slice(0, 25);
			return cmd.length < parsed.command.length ? `${cmd}...` : cmd;
		}

		// read/grep 等 - 显示路径
		if (["read", "grep", "find"].includes(toolName)) {
			const path = parsed.path || parsed.file || parsed.pattern;
			if (path) {
				const shortPath = String(path).split("/").pop() || String(path);
				return shortPath.slice(0, 25);
			}
		}

		// 其他工具 - 显示第一个字符串参数
		for (const key of Object.keys(parsed)) {
			if (typeof parsed[key] === "string" && parsed[key].length > 0) {
				return `${key}: ${parsed[key].slice(0, 25)}${parsed[key].length > 25 ? "..." : ""}`;
			}
		}
	} catch (e) {
		// 解析失败返回原始参数的前30字符
		return args.slice(0, 30) + (args.length > 30 ? "..." : "");
	}
	return "";
}

/**
 * 格式化工具参数显示
 * - 第一行显示简要信息（路径、命令等）
 * - 对于写文件类工具，格式化显示文件路径和内容
 * - 对内容部分进行适当的格式化（保留换行，代码样式）
 * - 支持流式字符串 (partialArgs) 和已完成对象 (args)
 */
function formatToolArgs(
	toolName: string,
	args: string | Record<string, unknown> | undefined,
): string {
	if (!args) return "";

	// 统一解析为对象
	let parsed: Record<string, unknown>;
	if (typeof args === "string") {
		try {
			parsed = JSON.parse(args);
		} catch (e) {
			// 不是 JSON，返回原始字符串
			return args;
		}
	} else {
		parsed = args;
	}

	// 第一行：简要信息
	let firstLine = "";

	// 提取第一行简要信息
	if (
		["write_file", "create_file", "edit_file", "apply_diff"].includes(toolName)
	) {
		const path =
			parsed.path || parsed.file_path || parsed.filepath || parsed.filePath;
		if (path) firstLine = `// File: ${path}`;
	} else if (toolName === "bash" && parsed.command) {
		firstLine = `$ ${parsed.command}`;
	} else if (["read", "grep", "find"].includes(toolName)) {
		const path = parsed.path || parsed.file || parsed.pattern;
		if (path) firstLine = `// Path: ${path}`;
	} else if (toolName === "ls" && parsed.path) {
		firstLine = `// Dir: ${parsed.path}`;
	}

	// 写文件类工具 - 特殊格式化
	if (
		["write_file", "create_file", "edit_file", "apply_diff"].includes(toolName)
	) {
		const content =
			parsed.content ||
			parsed.new_content ||
			parsed.newContent ||
			parsed.text ||
			"";
		if (content) {
			// 格式化：第一行路径，然后空行，然后内容
			return firstLine ? `${firstLine}\n\n${content}` : String(content);
		}
	}

	// 其他工具 - 格式化 JSON，但第一行显示简要信息
	const formattedJson = JSON.stringify(parsed, null, 2);
	return firstLine ? `${firstLine}\n${formattedJson}` : formattedJson;
}

/**
 * 为内容块添加索引
 */
function indexContentBlocks(content: MessageContent[]): IndexedContentBlock[] {
	return content.map((item, index) => ({ ...item, originalIndex: index }));
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
			// 为内容块添加索引
			return indexContentBlocks(message.content);
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
						isNewMessage={message.isStreaming} // 流式消息视为新消息
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
	isNewMessage = false,
	showThinking,
	showTools = true,
}: GlassCardProps) {
	// ========== 1. State ==========
	// 默认展开规则：
	// - 新消息（流式中）：全部展开
	// - 历史消息：text 展开，thinking/tool 折叠
	const getDefaultExpanded = () => {
		if (isNewMessage) return true;
		if (block.type === "text") return true;
		return false; // thinking, tool_use, tool 默认折叠
	};
	const [isExpanded, setIsExpanded] = useState(getDefaultExpanded);
	const [isCopyVisible, setIsCopyVisible] = useState(false);

	// ========== 2. Effects ==========
	// 只在流式真正结束时（从 true 变为 false）才折叠（针对流式消息）
	const wasStreamingRef = useRef(isStreaming);
	useEffect(() => {
		const wasStreaming = wasStreamingRef.current;
		wasStreamingRef.current = isStreaming;

		// 只对新消息：流式结束（true -> false）且不是 text 类型时才折叠
		if (isNewMessage && wasStreaming && !isStreaming && block.type !== "text") {
			setIsExpanded(false);
		}
	}, [isStreaming, block.type, isNewMessage]);

	// ========== 3. Actions ==========
	const toggleExpand = useCallback(
		(e?: React.MouseEvent) => {
			// 如果点击的是复制按钮或内容区域，不触发折叠
			if (e) {
				const target = e.target as HTMLElement;
				if (
					target.closest(`.${styles.btnCopy}`) ||
					target.closest(`.${styles.content}`)
				) {
					return;
				}
			}
			if (block.type !== "text") {
				setIsExpanded((prev) => !prev);
			}
		},
		[block.type],
	);

	const copyToClipboard = useCallback((text: string) => {
		navigator.clipboard.writeText(text);
	}, []);

	switch (block.type) {
		case "thinking": {
			if (!showThinking) return null;
			const thinkingText = safeString(block.thinking);
			return (
				<div
					className={`${styles.card} ${styles.thinking} ${isStreaming ? styles.streaming : ""} ${isExpanded ? styles.expanded : styles.collapsed}`}
					onClick={(e) => toggleExpand(e)}
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
								{isExpanded ? "−" : "+"}
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
			// 流式中的工具调用 - 只显示参数，没有结果
			if (!showTools) return null;

			const toolName = block.toolName || "unknown";
			const toolArgs = block.partialArgs ?? block.args;

			// 解析参数摘要和格式化
			const summary = parseToolSummary(toolName, toolArgs);
			const formattedArgs = formatToolArgs(toolName, toolArgs);

			return (
				<div
					className={`${styles.card} ${styles.toolUse} ${isStreaming ? styles.streaming : ""} ${isExpanded ? styles.expanded : styles.collapsed}`}
					onClick={(e) => toggleExpand(e)}
					onMouseEnter={() => setIsCopyVisible(true)}
					onMouseLeave={() => setIsCopyVisible(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} />
						<span className={styles.label}>{toolName}</span>
						{summary && <span className={styles.summary}>{summary}</span>}
						<span className={`${styles.chip} ${styles.running}`}>running</span>
						<div className={styles.actions}>
							<button
								className={styles.btnCopy}
								style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
								onClick={(e) => {
									e.stopPropagation();
									copyToClipboard(formattedArgs);
								}}
							>
								📋
							</button>
							<span className={styles.toggleIcon}>
								{isExpanded ? "−" : "+"}
							</span>
						</div>
					</div>
					{isExpanded && (
						<div
							className={styles.content}
							onClick={(e) => e.stopPropagation()}
						>
							<div className={styles.toolSection}>
								<div className={styles.toolSectionLabel}>Arguments:</div>
								<pre className={styles.toolCode}>
									<code>{formattedArgs}</code>
								</pre>
							</div>
						</div>
					)}
				</div>
			);
		}

		case "tool": {
			// tool 类型包含已完成的工具调用（参数 + 结果）
			if (!showTools) return null;

			const toolName = block.toolName || "unknown";
			const toolArgs = block.args;
			const status = block.error
				? "error"
				: block.output
					? "success"
					: "pending";

			// 格式化参数和结果
			const formattedArgs = formatToolArgs(toolName, toolArgs);
			const resultOutput = block.output || block.error || "";
			const hasResult = !!resultOutput;

			// 完整内容（复制用）
			const fullContent = hasResult
				? `${formattedArgs}\n\n// Result:\n${resultOutput}`
				: formattedArgs;

			// 摘要显示在顶部
			const summary = parseToolSummary(
				toolName,
				typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs),
			);

			return (
				<div
					className={`${styles.card} ${styles.toolUse} ${isStreaming ? styles.streaming : ""} ${block.error ? styles.toolError : block.output ? styles.toolSuccess : ""} ${isExpanded ? styles.expanded : styles.collapsed}`}
					onClick={(e) => toggleExpand(e)}
					onMouseEnter={() => setIsCopyVisible(true)}
					onMouseLeave={() => setIsCopyVisible(false)}
				>
					<div className={styles.cardHeader}>
						<span className={styles.dot} />
						<span className={styles.label}>{toolName}</span>
						{summary && <span className={styles.summary}>{summary}</span>}
						<span className={`${styles.chip} ${styles[status]}`}>{status}</span>
						<div className={styles.actions}>
							<button
								className={styles.btnCopy}
								style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
								onClick={(e) => {
									e.stopPropagation();
									copyToClipboard(fullContent);
								}}
							>
								📋
							</button>
							<span className={styles.toggleIcon}>
								{isExpanded ? "−" : "+"}
							</span>
						</div>
					</div>
					{isExpanded && (
						<div
							className={styles.content}
							onClick={(e) => e.stopPropagation()}
						>
							{/* 参数部分 */}
							<div className={styles.toolSection}>
								<div className={styles.toolSectionLabel}>Arguments:</div>
								<pre className={styles.toolCode}>
									<code>{formattedArgs}</code>
								</pre>
							</div>

							{/* 结果部分（如果有） */}
							{hasResult && (
								<div
									className={`${styles.toolSection} ${block.error ? styles.toolSectionError : styles.toolSectionSuccess}`}
								>
									<div className={styles.toolSectionLabel}>Result:</div>
									<code>{resultOutput}</code>
								</div>
							)}
						</div>
					)}
				</div>
			);
		}

		case "text":
			if (!block.text) return null;
			return (
				<div
					className={`${styles.card} ${styles.output} ${isStreaming ? styles.streaming : ""}`}
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
