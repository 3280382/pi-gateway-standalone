/**
 * ModernChat - Complete chat interface with all slash commands
 */

import React, { useRef, useEffect, useState } from "react";
import { ModernMessage, MessageRole } from "./ModernMessage";
import { ModernInputArea } from "./ModernInputArea";
import styles from "./ModernChat.module.css";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp?: Date;
  toolName?: string;
  toolStatus?: "running" | "complete" | "error";
}

interface ModernChatProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  isStreaming?: boolean;
  currentModel?: string;
  sessionId?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export const ModernChat: React.FC<ModernChatProps> = ({
  messages,
  inputValue,
  onInputChange,
  onSend,
  onAbort,
  isStreaming = false,
  currentModel,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (messagesEndRef.current && !showScrollButton) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showScrollButton]);

  // Handle scroll to show/hide scroll button
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

  return (
    <div className={styles.container}>
      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className={styles.messagesArea}
        onScroll={handleScroll}
      >
        {/* Load More Button */}
        {hasMore && (
          <div className={styles.loadMore}>
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className={styles.loadMoreButton}
            >
              {isLoadingMore ? "Loading..." : "Load more messages"}
            </button>
          </div>
        )}

        {/* Messages */}
        <div className={styles.messagesList}>
          {messages.map((message, index) => (
            <ModernMessage
              key={message.id || index}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              isStreaming={isStreaming && index === messages.length - 1}
              toolName={message.toolName}
              toolStatus={message.toolStatus}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          className={styles.scrollButton}
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Input Area */}
      <div className={styles.inputArea}>
        {currentModel && (
          <div className={styles.modelIndicator}>
            Using <strong>{currentModel}</strong>
          </div>
        )}
        <ModernInputArea
          value={inputValue}
          onChange={onInputChange}
          onSend={onSend}
          onAbort={onAbort}
          isStreaming={isStreaming}
          placeholder="Message... (Type / for commands)"
        />
      </div>
    </div>
  );
};

export default ModernChat;
