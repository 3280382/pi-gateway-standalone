/**
 * ModernMessage - Beautiful message bubbles with markdown support
 */

import React from "react";
import { User, Bot, Copy, RefreshCw, Terminal } from "lucide-react";
import styles from "./ModernMessage.module.css";

export type MessageRole = "user" | "assistant" | "system" | "tool";

interface ModernMessageProps {
  role: MessageRole;
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  toolName?: string;
  toolStatus?: "running" | "complete" | "error";
}

export const ModernMessage: React.FC<ModernMessageProps> = ({
  role,
  content,
  timestamp,
  isStreaming = false,
  onCopy,
  onRegenerate,
  toolName,
  toolStatus,
}) => {
  const isUser = role === "user";
  const isTool = role === "tool";

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Simple markdown-like formatting
  const formatContent = (text: string) => {
    // Code blocks
    text = text.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      '<pre class="${styles.codeBlock}"><code>$2</code></pre>'
    );
    // Inline code
    text = text.replace(
      /`([^`]+)`/g,
      '<code class="${styles.inlineCode}">$1</code>'
    );
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // Line breaks
    text = text.replace(/\n/g, "<br />");
    return text;
  };

  return (
    <div
      className={`${styles.container} ${isUser ? styles.user : ""} ${
        isTool ? styles.tool : ""
      } ${isStreaming ? styles.streaming : ""}`}
    >
      {/* Avatar */}
      <div className={styles.avatar}>
        {isUser ? (
          <User size={18} />
        ) : isTool ? (
          <Terminal size={18} />
        ) : (
          <Bot size={18} />
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.role}>
            {isUser ? "You" : isTool ? toolName || "Tool" : "Assistant"}
          </span>
          {timestamp && (
            <span className={styles.timestamp}>{formatTime(timestamp)}</span>
          )}
        </div>

        {/* Message Body */}
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: formatContent(content) }}
        />

        {/* Tool Status */}
        {isTool && toolStatus && (
          <div className={`${styles.toolStatus} ${styles[toolStatus]}`}>
            {toolStatus === "running" && (
              <>
                <span className={styles.spinner} />
                Running...
              </>
            )}
            {toolStatus === "complete" && "Complete"}
            {toolStatus === "error" && "Error"}
          </div>
        )}

        {/* Streaming Indicator */}
        {isStreaming && (
          <div className={styles.streamingIndicator}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}

        {/* Actions */}
        {!isUser && !isStreaming && (
          <div className={styles.actions}>
            <button
              className={styles.actionButton}
              onClick={onCopy}
              title="Copy message"
            >
              <Copy size={14} />
              <span>Copy</span>
            </button>
            {onRegenerate && (
              <button
                className={styles.actionButton}
                onClick={onRegenerate}
                title="Regenerate"
              >
                <RefreshCw size={14} />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernMessage;
