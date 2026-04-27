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
import { useChatStore } from "@/features/chat/stores/chatStore";
import { SmartContent } from "./SmartContent";
import styles from "./MessageItem.module.css";

// ============================================================================
// Types
// ============================================================================

interface MessageItemProps {
  message: Message;
  showThinking: boolean;
  showTools?: boolean;
  showText?: boolean; // Control text content display
  searchFilters?: import("@/features/chat/types/chat").ChatSearchFilters;
  onToggleCollapse: () => void;
  onToggleThinking: () => void;
  onToggleTools?: () => void;
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
  showText?: boolean;
  messageKind?: Message["kind"];
  kind1?: Message["kind1"]; // Message source for correct sysinfo identification
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
// URL Preview Modal
// ============================================================================

function UrlPreviewModal() {
  const urlPreview = useChatStore((s) => s.urlPreview);
  const closeUrlPreview = useChatStore((s) => s.closeUrlPreview);

  if (!urlPreview.isOpen || !urlPreview.url) return null;

  return (
    <div className={styles.urlOverlay}>
      <div className={styles.urlHeader}>
        <span className={styles.urlTitle}>{urlPreview.url}</span>
        <button type="button" className={styles.urlClose} onClick={closeUrlPreview} title="Close">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <title>Close</title>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <iframe
        src={urlPreview.url}
        className={styles.urlFrame}
        title="URL Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export const MessageItem = memo(
  function MessageItem({
    message,
    showThinking,
    showTools = true,
    showText = true,
    searchFilters,
  }: MessageItemProps) {
    // DEBUG: Log message rendering
    console.log(
      "[MessageItem] Rendering message:",
      message.id,
      "kind1=",
      message.kind1,
      "content types=",
      message.content?.map((c: any) => c.type)
    );

    // ========== 4. Computed ==========
    // Use new kind1/kind2/kind3 fields, fallback to role/kind for backward compatibility
    // Map role="system" to kind1="sysinfo" to avoid confusion with API system role
    const kind1 =
      message.kind1 || (message.role === "system" ? "sysinfo" : message.role) || "sysinfo";
    const kind3 = message.kind3 || message.kind;

    const isUser = kind1 === "user";
    const isSysinfo = kind1 === "sysinfo";
    const isAssistant = kind1 === "assistant";

    const blocks = useMemo(() => {
      if (!message.content || !Array.isArray(message.content)) return [];
      let content = message.content;

      // Content-block-level filtering based on searchFilters
      if (searchFilters?.kind2 && isAssistant) {
        content = content.filter((block) => {
          // Always show these types
          if (block.type === "image" || block.type === "turn_marker") return true;
          // Filter by kind2 settings
          if (block.type === "thinking" && !searchFilters.kind2.thinking) return false;
          if ((block.type === "tool" || block.type === "tool_use") && !searchFilters.kind2.tool)
            return false;
          if (block.type === "text" && !searchFilters.kind2.response) return false;
          return true;
        });
      }

      return indexContentBlocks(content);
    }, [message.content, searchFilters, isAssistant]);

    // ========== 5. Render ==========
    // Note: Message-level filtering is done in ChatPanel.tsx via filterMessages()
    // MessageItem also handles content-block-level filtering via searchFilters

    if (isUser) {
      const text = blocks
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      const imageBlocks = blocks.filter((c) => c.type === "image");
      return (
        <div className={styles.userMessage}>
          <div className={styles.userBubble}>
            {text && <div>{text}</div>}
            {imageBlocks.map((img, i) => (
              <UserImage key={`img-${i}`} block={img} />
            ))}
          </div>
        </div>
      );
    }

    // For system messages, if all content is filtered out, don't render
    if (isSysinfo && blocks.length === 0) {
      return null;
    }

    // For assistant messages, if all content is filtered out, don't render
    if (isAssistant && blocks.length === 0) {
      return null;
    }

    // Container styling based on kind1
    const containerClass = isSysinfo
      ? `${styles.sysinfoContainer} ${kind3 ? styles[kind3] : ""}`
      : isAssistant
        ? styles.assistantContainer
        : styles.userMessage;

    return (
      <div className={containerClass}>
        {blocks.map((block) => {
          // DEBUG: Log block rendering
          console.log("[MessageItem] Rendering block:", block.type, block.toolName || "");

          // Use stable key: toolCallId for tools, originalIndex for others
          // This prevents React key collisions when filtering blocks
          const stableKey =
            (block.type === "tool_use" || block.type === "tool") && block.toolCallId
              ? `tool-${block.toolCallId}`
              : `${block.type}-${block.originalIndex}`;

          return (
            <GlassCard
              key={stableKey}
              block={block}
              isStreaming={message.isStreaming}
              isNewMessage={message.isStreaming} // Only streaming messages default expand
              showThinking={showThinking}
              showTools={showTools ?? true}
              showText={showText}
              messageKind={kind3 as any}
              kind1={kind1}
            />
          );
        })}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Fast path: check primitive props first
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.message.isStreaming !== nextProps.message.isStreaming) return false;
    if (prevProps.showThinking !== nextProps.showThinking) return false;
    if ((prevProps.showTools ?? true) !== (nextProps.showTools ?? true)) return false;

    // Compare message content length first (quick check)
    const prevContent = prevProps.message.content;
    const nextContent = nextProps.message.content;
    if (prevContent?.length !== nextContent?.length) return false;

    // Compare each content block
    if (prevContent && nextContent) {
      for (let i = 0; i < prevContent.length; i++) {
        if (prevContent[i] !== nextContent[i]) return false;
      }
    }

    return true;
  }
);

function GlassCard({
  block,
  isStreaming = false,
  isNewMessage = false,
  showThinking,
  showText = true,
  messageKind,
  kind1,
}: GlassCardProps) {
  // ========== 1. State (ALL hooks must be called before any conditional returns) ==========
  const [isExpanded, setIsExpanded] = useState(() => {
    if (block.type === "text") return true;
    if (block.type === "thinking") return false;
    if (block.type === "tool_use" || block.type === "tool") return false;
    return true;
  });
  const [isCopyVisible, setIsCopyVisible] = useState(false);
  const [sysinfoExpanded, setSysinfoExpanded] = useState(false);

  // ========== 2. Effects ==========
  const wasStreamingRef = useRef(isStreaming);
  useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = isStreaming;

    if (isNewMessage && wasStreaming && !isStreaming && block.type !== "text") {
      setIsExpanded(false);
    }
  }, [isStreaming, block.type, isNewMessage]);

  // ========== 3. Actions ==========
  const toggleExpand = useCallback(
    (e?: React.MouseEvent) => {
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

  // ========== 4. Render (ALL hooks above this line) ==========

  // Render thinking block
  if (block.type === "thinking") {
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

  // Render tool_use block
  if (block.type === "tool_use") {
    // DEBUG: Always show tool_use blocks
    console.log("[MessageItem] Rendering tool_use:", block.toolName, block.toolCallId);

    // Check tool status filter - DEBUG: bypass for now
    const toolStatus = block.status || (isStreaming ? "running" : "pending");

    const toolName = block.toolName || "unknown";
    const toolArgs = block.partialArgs ?? block.args;
    const formattedArgs = formatToolArgs(toolName, toolArgs);
    const statusText =
      {
        running: "Executing...",
        executing: "Executing...",
        pending: "Waiting...",
        timeout: "Execution timeout",
        error: "Execution failed",
        success: "Completed",
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
          <span className={`${styles.chip} ${styles[toolStatus] || styles.pending}`}>
            {statusText}
          </span>
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
            {block.output && (
              <div className={styles.toolSection}>
                <div className={styles.toolSectionLabel}>Output:</div>
                <pre className={`${styles.toolCode} ${styles.toolOutput}`}>
                  <code>{safeString(block.output)}</code>
                </pre>
              </div>
            )}
            {block.error && (
              <div className={styles.toolSection}>
                <div className={styles.toolSectionLabel}>Error:</div>
                <pre className={`${styles.toolCode} ${styles.toolErrorText}`}>
                  <code>{safeString(block.error)}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Render tool block
  if (block.type === "tool") {
    // DEBUG: Always show tool blocks
    console.log(
      "[MessageItem] Rendering tool:",
      block.toolName,
      "output=",
      !!block.output,
      "error=",
      !!block.error
    );

    const status = block.error ? "error" : block.output ? "success" : "pending";

    const toolName = block.toolName || "unknown";
    const toolArgs = block.args;
    const formattedArgs = formatToolArgs(toolName, toolArgs);
    const resultOutput = safeString(block.output || block.error || "");
    const hasResult = !!resultOutput;
    const fullContent = hasResult
      ? `${formattedArgs}\n\n// Result:\n${resultOutput}`
      : formattedArgs;

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
            <div className={styles.toolSection}>
              <div className={styles.toolSectionLabel}>Arguments:</div>
              <pre className={styles.toolCode}>
                <code>{formattedArgs}</code>
              </pre>
            </div>
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

  // Render text block
  if (block.type === "text") {
    if (!showText) return null;
    if (!block.text) return null;

    // System messages display (model_change, thinking_level_change, usage, compaction, etc.)
    if (kind1 === "sysinfo" && messageKind) {
      const cleanText = block.text
        .replace(/^🤖\s*/, "")
        .replace(/^🧠\s*/, "")
        .replace(/^🗜️\s*/, "")
        .replace(/^📊\s*/, "")
        .replace(/^💰\s*/, "")
        .replace(/^🔄\s*/, "")
        .replace(/^Model switched to:\s*/, "")
        .replace(/^Thinking level set to:\s*/, "")
        .replace(/^Context compaction:\s*/, "")
        .replace(/^Usage:\s*/, "")
        .replace(/^Cost:\s*/, "");

      const kindLabels: Record<string, string> = {
        model_change: "Model",
        thinking_level_change: "Reasoning Level",
        compaction: "Compaction",
        usage: "Usage",
        retry: "Retry",
        auto_retry: "Auto Retry",
        export: "Export",
      };
      const subLabel = kindLabels[messageKind] || "System";

      // Usage - 标题显示一行关键信息，详细内容可展开
      if (messageKind === "usage") {
        // Split header and details
        const lines = cleanText.split("\n");
        const headerLine = lines[0];
        const detailLines = lines.slice(2).join("\n"); // Skip empty line after header

        return (
          <div
            className={`${styles.card} ${styles[messageKind]} ${sysinfoExpanded ? styles.expanded : styles.collapsed}`}
            onClick={() => setSysinfoExpanded(!sysinfoExpanded)}
            onMouseEnter={() => setIsCopyVisible(true)}
            onMouseLeave={() => setIsCopyVisible(false)}
          >
            <div className={styles.cardHeader}>
              <span className={`${styles.dot} ${styles[`${messageKind}Dot`]}`} />
              <span className={styles.label}>{subLabel}</span>
              <span className={styles.summary}>{headerLine}</span>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnCopy}
                  style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(cleanText);
                  }}
                >
                  📋
                </button>
                <span className={styles.toggleIcon}>{sysinfoExpanded ? "−" : "+"}</span>
              </div>
            </div>
            {sysinfoExpanded && detailLines && (
              <div className={styles.content} onClick={(e) => e.stopPropagation()}>
                <code>{detailLines}</code>
              </div>
            )}
          </div>
        );
      }

      return (
        <div
          className={`${styles.card} ${styles[messageKind]} ${sysinfoExpanded ? styles.expanded : styles.collapsed}`}
          onClick={() => setSysinfoExpanded(!sysinfoExpanded)}
          onMouseEnter={() => setIsCopyVisible(true)}
          onMouseLeave={() => setIsCopyVisible(false)}
        >
          <div className={styles.cardHeader}>
            <span className={`${styles.dot} ${styles[`${messageKind}Dot`]}`} />
            <span className={styles.label}>{subLabel}</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btnCopy}
                style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(cleanText);
                }}
              >
                📋
              </button>
              <span className={styles.toggleIcon}>{sysinfoExpanded ? "−" : "+"}</span>
            </div>
          </div>
          {sysinfoExpanded && (
            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
              <code>{cleanText}</code>
            </div>
          )}
        </div>
      );
    }

    // Regular assistant message
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
          <SmartContent text={block.text} />
        </div>
      </div>
    );
  }

  // Render image block
  if (block.type === "image") {
    const imageUrl = getImageUrl(block);
    if (!imageUrl) return null;

    const isExpandable = kind1 === "assistant" || (kind1 === "user" && block.source?.data);
    return (
      <div
        className={styles.imageBlock}
        onMouseEnter={() => setIsCopyVisible(true)}
        onMouseLeave={() => setIsCopyVisible(false)}
      >
        <div className={styles.cardHeader}>
          <span className={styles.dot} />
          <span className={styles.label}>Image</span>
          <div className={styles.actions}>
            {isExpandable && (
              <button
                type="button"
                className={styles.btnCopy}
                style={{ visibility: isCopyVisible ? "visible" : "hidden" }}
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(imageUrl);
                }}
              >
                📋
              </button>
            )}
          </div>
        </div>
        <div className={styles.imageContent}>
          <img
            src={imageUrl}
            alt="User uploaded image"
            className={styles.imagePreview}
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Extract image URL from content block.
 * Handles:
 * - Direct imageUrl field
 * - Base64 source with data URL construction
 *   - mediaType field (shared types)
 *   - mimeType field (JSONL session files)
 */
function getImageUrl(block: IndexedContentBlock): string | null {
  if (block.imageUrl) return block.imageUrl;
  if (block.source?.data) {
    const mediaType = block.source.mediaType || block.source.mimeType || "image/png";
    return `data:${mediaType};base64,${block.source.data}`;
  }
  // Defensive: handle pi-ai ImageContent format { data, mimeType }
  if (block.data && block.mimeType) {
    return `data:${block.mimeType};base64,${block.data}`;
  }
  return null;
}

/**
 * Inline image component for user messages.
 */
function UserImage({ block }: { block: IndexedContentBlock }) {
  const imageUrl = getImageUrl(block);
  if (!imageUrl) return null;
  return (
    <img src={imageUrl} alt="User uploaded image" className={styles.userImage} loading="lazy" />
  );
}

// SmartContent is now in SmartContent.tsx, exported as SmartContent
// UrlPreviewModal renders the URL iframe overlay
export { UrlPreviewModal };
