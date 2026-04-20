/**
 * MessageItem - Individual message rendering component
 *
 * Responsibilities:
 * - Render single message (user or AI)
 * - Handle message content block rendering（thinking, tool_use, tool, text）
 * - Merge tool_use and tool resultsinto a complete tool call card
 * - 不包含业务逻辑
 *
 * Structure:State → Ref → Effects → Computed → Actions → Render
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

// Content block type (with original index)
interface IndexedContentBlock extends MessageContent {
  originalIndex: number;
}

interface GlassCardProps {
  block: IndexedContentBlock;
  isStreaming?: boolean;
  isNewMessage?: boolean; // true=streaming message (default expand), false=historical message(thinking/tool default collapse)
  showThinking: boolean;
  showTools?: boolean;
  messageKind?: Message["kind"];
}

// ============================================================================
// Helpers
// ============================================================================

function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    if (val && "content" in val && typeof (val as Record<string, unknown>).content === "string") {
      return (val as Record<string, string>).content;
    }
    return JSON.stringify(val, null, 2);
  }
  return String(val);
}

/**
 * Parse tool params, extract key infofor top display
 */
function parseToolSummary(toolName: string, args: string | undefined): string {
  if (!args) return "";

  try {
    const parsed = JSON.parse(args);

    // Files写入类工具 - show file path
    if (["write_file", "create_file", "edit_file", "apply_diff"].includes(toolName)) {
      const path = parsed.path || parsed.file_path || parsed.filepath || parsed.filePath;
      if (path) {
        // Simplify path display
        const shortPath = path.split("/").pop() || path;
        return `→ ${shortPath}`;
      }
    }

    // bash command - show first 20 chars of command
    if (toolName === "bash" && parsed.command) {
      const cmd = parsed.command.slice(0, 25);
      return cmd.length < parsed.command.length ? `${cmd}...` : cmd;
    }

    // read/grep etc - show path
    if (["read", "grep", "find"].includes(toolName)) {
      const path = parsed.path || parsed.file || parsed.pattern;
      if (path) {
        const shortPath = String(path).split("/").pop() || String(path);
        return shortPath.slice(0, 25);
      }
    }

    // Others工具 - show first string parameter
    for (const key of Object.keys(parsed)) {
      if (typeof parsed[key] === "string" && parsed[key].length > 0) {
        return `${key}: ${parsed[key].slice(0, 25)}${parsed[key].length > 25 ? "..." : ""}`;
      }
    }
  } catch (_e) {
    // Parse failed: return first 30 chars
    return args.slice(0, 30) + (args.length > 30 ? "..." : "");
  }
  return "";
}

/**
 * Formatter utilitiesArguments显示
 * - First line shows brief info（path, command, etc）
 * - For file write tools，格式化show file path和内容
 * - Properly format content part（preserve newlines, code style）
 * - Support streaming strings (partialArgs) and completed objects (args)
 */
function formatToolArgs(
  toolName: string,
  args: string | Record<string, unknown> | undefined
): string {
  if (!args) return "";

  // Uniformly parse as object
  let parsed: Record<string, unknown>;
  if (typeof args === "string") {
    try {
      parsed = JSON.parse(args);
    } catch (_e) {
      // Not JSON, return raw string
      return args;
    }
  } else {
    parsed = args;
  }

  // First line: brief info
  let firstLine = "";

  // Extract first line brief info
  if (["write_file", "create_file", "edit_file", "apply_diff"].includes(toolName)) {
    const path = parsed.path || parsed.file_path || parsed.filepath || parsed.filePath;
    if (path) firstLine = `// File: ${path}`;
  } else if (toolName === "bash" && parsed.command) {
    firstLine = `$ ${parsed.command}`;
  } else if (["read", "grep", "find"].includes(toolName)) {
    const path = parsed.path || parsed.file || parsed.pattern;
    if (path) firstLine = `// Path: ${path}`;
  } else if (toolName === "ls" && parsed.path) {
    firstLine = `// Dir: ${parsed.path}`;
  }

  // File write tools - special formatting
  if (["write_file", "create_file", "edit_file", "apply_diff"].includes(toolName)) {
    const content = parsed.content || parsed.new_content || parsed.newContent || parsed.text || "";
    if (content) {
      // Format: first line path，then empty line, then content
      return firstLine ? `${firstLine}\n\n${content}` : String(content);
    }
  }

  // Others工具 - 格式化 JSON，但First line shows brief info
  const formattedJson = JSON.stringify(parsed, null, 2);
  return firstLine ? `${firstLine}\n${formattedJson}` : formattedJson;
}

/**
 * Add index to content blocks
 */
function indexContentBlocks(content: MessageContent[]): IndexedContentBlock[] {
  return content.map((item, index) => ({ ...item, originalIndex: index }));
}

// ============================================================================
// Component
// ============================================================================

export const MessageItem = memo(
  function MessageItem({ message, showThinking, showTools = true }: MessageItemProps) {
    // ========== 4. Computed ==========
    const isUser = message.role === "user";

    const blocks = useMemo(() => {
      if (!message.content || !Array.isArray(message.content)) return [];
      // Add index to content blocks
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

    // Detect if compaction message
    const isCompaction = message.kind === "compaction";
    
    return (
      <div className={`${styles.aiContainer} ${isCompaction ? styles.compactionContainer : ""}`}>
        {blocks.map((block, idx) => (
          <GlassCard
            key={`${block.type}-${idx}`}
            block={block}
            isStreaming={message.isStreaming}
            isNewMessage={message.isStreaming} // Streaming message treated as new
            showThinking={showThinking}
            showTools={showTools ?? true}
            messageKind={message.kind}
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
  }
);

function GlassCard({
  block,
  isStreaming = false,
  isNewMessage = false,
  showThinking,
  showTools = true,
  messageKind,
}: GlassCardProps) {
  // ========== 1. State ==========
  // Default expand rules:
  // - New messages (streaming): expand all
  // - Historical: text expand，thinking/tool collapse
  const getDefaultExpanded = () => {
    if (isNewMessage) return true;
    if (block.type === "text") return true;
    return false; // thinking, tool_use, tool default collapse
  };
  const [isExpanded, setIsExpanded] = useState(getDefaultExpanded);
  const [isCopyVisible, setIsCopyVisible] = useState(false);

  // ========== 2. Effects ==========
  // Only when streaming truly ends（from true to false）collapse (for streaming messages)
  const wasStreamingRef = useRef(isStreaming);
  useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = isStreaming;

    // Only for new messages: streaming ends（true -> false）and not text type then collapse
    if (isNewMessage && wasStreaming && !isStreaming && block.type !== "text") {
      setIsExpanded(false);
    }
  }, [isStreaming, block.type, isNewMessage]);

  // ========== 3. Actions ==========
  const toggleExpand = useCallback(
    (e?: React.MouseEvent) => {
      // If clicking copy buttonor content area, don't trigger collapse
      if (e) {
        const target = e.target as HTMLElement;
        if (target.closest(`.${styles.btnCopy}`) || target.closest(`.${styles.content}`)) {
          return;
        }
      }
      if (block.type !== "text") {
        setIsExpanded((prev) => !prev);
      }
    },
    [block.type]
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
                type="button"
                className={styles.btnCopy}
                style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(thinkingText);
                }}
              >
                📋
              </button>
              <span className={styles.toggleIcon}>{isExpanded ? "−" : "+"}</span>
            </div>
          </div>
          {isExpanded && (
            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
              <code>{thinkingText}</code>
            </div>
          )}
        </div>
      );
    }

    case "tool_use": {
      // Tool calls in streamingor without execution results
      if (!showTools) return null;

      const toolName = block.toolName || "unknown";
      const toolArgs = block.partialArgs ?? block.args;
      const toolStatus = block.status || (isStreaming ? "running" : "pending");

      // Parse param summary and formatting
      const summary = parseToolSummary(toolName, toolArgs);
      const formattedArgs = formatToolArgs(toolName, toolArgs);

      // Status display text
      const statusText = {
        running: "Executing...",
        pending: "Waiting...",
        timeout: "Execution timeout",
        error: "Execution failed",
      }[toolStatus] || toolStatus;

      return (
        <div
          className={`${styles.card} ${styles.toolUse} ${styles[toolStatus] || ""} ${isStreaming ? styles.streaming : ""} ${isExpanded ? styles.expanded : styles.collapsed}`}
          onClick={(e) => toggleExpand(e)}
          onMouseEnter={() => setIsCopyVisible(true)}
          onMouseLeave={() => setIsCopyVisible(false)}
        >
          <div className={styles.cardHeader}>
            <span className={styles.dot} />
            <span className={styles.label}>{toolName}</span>
            {summary && <span className={styles.summary}>{summary}</span>}
            <span className={`${styles.chip} ${styles[toolStatus] || styles.pending}`}>{statusText}</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnCopy}
                style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(formattedArgs);
                }}
              >
                📋
              </button>
              <span className={styles.toggleIcon}>{isExpanded ? "−" : "+"}</span>
            </div>
          </div>
          {isExpanded && (
            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
              <div className={styles.toolSection}>
                <div className={styles.toolSectionLabel}>Arguments:</div>
                <pre className={styles.toolCode}>
                  <code>{formattedArgs}</code>
                </pre>
              </div>
              {/* Show execution results (if any) */}
              {block.output && (
                <div className={styles.toolSection}>
                  <div className={styles.toolSectionLabel}>Output:</div>
                  <pre className={`${styles.toolCode} ${styles.toolOutput}`}>
                    <code>{block.output}</code>
                  </pre>
                </div>
              )}
              {block.error && (
                <div className={styles.toolSection}>
                  <div className={styles.toolSectionLabel}>Error:</div>
                  <pre className={`${styles.toolCode} ${styles.toolErrorText}`}>
                    <code>{block.error}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    case "tool": {
      // tool type contains completed calls（Arguments + 结果）
      if (!showTools) return null;

      const toolName = block.toolName || "unknown";
      const toolArgs = block.args;
      const status = block.error ? "error" : block.output ? "success" : "pending";

      // Format params and results
      const formattedArgs = formatToolArgs(toolName, toolArgs);
      const resultOutput = block.output || block.error || "";
      const hasResult = !!resultOutput;

      // Complete content (for copying)
      const fullContent = hasResult
        ? `${formattedArgs}\n\n// Result:\n${resultOutput}`
        : formattedArgs;

      // Summary displayed at top
      const summary = parseToolSummary(
        toolName,
        typeof toolArgs === "string" ? toolArgs : JSON.stringify(toolArgs)
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
                type="button"
                className={styles.btnCopy}
                style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(fullContent);
                }}
              >
                📋
              </button>
              <span className={styles.toggleIcon}>{isExpanded ? "−" : "+"}</span>
            </div>
          </div>
          {isExpanded && (
            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
              {/* Parameter section */}
              <div className={styles.toolSection}>
                <div className={styles.toolSectionLabel}>Arguments:</div>
                <pre className={styles.toolCode}>
                  <code>{formattedArgs}</code>
                </pre>
              </div>

              {/* Result section (if any) */}
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
      
      // Detect if usage message
      const isUsageMessage = block.text.startsWith("📊 Usage:");
      if (isUsageMessage) {
        return (
          <div className={`${styles.card} ${styles.usage}`}>
            <div className={styles.usageHeader}>
              <span className={styles.usageDot} />
              <span className={styles.usageLabel}>Usage</span>
            </div>
            <div className={styles.usageContent}>
              {block.text.replace("📊 Usage: ", "")}
            </div>
          </div>
        );
      }
      
      // Determine label by messageKind
      const label = messageKind === "compaction" ? "Compaction" : 
                    messageKind === "export" ? "Export" :
                    messageKind === "usage" ? "Usage" : "Assistant";
      
      return (
        <div
          className={`${styles.card} ${styles.output} ${isStreaming ? styles.streaming : ""} ${messageKind ? styles[messageKind] : ""}`}
          onMouseEnter={() => setIsCopyVisible(true)}
          onMouseLeave={() => setIsCopyVisible(false)}
        >
          <div className={styles.cardHeader}>
            <span className={`${styles.dot} ${messageKind ? styles[messageKind + "Dot"] : ""}`} />
            <span className={styles.label}>{label}</span>
            <div className={styles.actions}>
              <button
                type="button"
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
                  return <strong key={`${pidx}-${bidx}`}>{bp.slice(2, -2)}</strong>;
                }
                const italicParts = bp.split(/(\*[^*]+\*)/g);
                return italicParts.map((ip, iidx) => {
                  if (ip.startsWith("*") && ip.endsWith("*") && !ip.startsWith("**")) {
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
