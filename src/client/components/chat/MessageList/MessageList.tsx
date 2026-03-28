/**
 * MessageList - Simple scrollable message list
 * No virtual scrolling, let CSS handle heights
 */

import { useRef, useEffect } from 'react';
import { MessageItem } from '../MessageItem/MessageItem';
import type { Message } from '../../../types/chat';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
  currentStreamingMessage: Message | null;
  showThinking: boolean;
  onToggleMessageCollapse: (id: string) => void;
  onToggleThinkingCollapse: (id: string) => void;
}

export function MessageList({
  messages,
  currentStreamingMessage,
  showThinking,
  onToggleMessageCollapse,
  onToggleThinkingCollapse,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  const allMessages = currentStreamingMessage
    ? [...messages, currentStreamingMessage]
    : messages;

  // Auto-scroll to bottom
  useEffect(() => {
    if (shouldScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [allMessages.length]);

  // Detect manual scroll
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      shouldScrollRef.current = isAtBottom;
    }
  };

  if (allMessages.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.logo}>π</div>
          <h1>Welcome to Pi Gateway</h1>
          <p>Start a conversation by typing a message below.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onScroll={handleScroll}
    >
      {allMessages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          showThinking={showThinking}
          onToggleCollapse={() => onToggleMessageCollapse(message.id)}
          onToggleThinking={() => onToggleThinkingCollapse(message.id)}
        />
      ))}
    </div>
  );
}
