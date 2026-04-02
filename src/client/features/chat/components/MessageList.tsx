/**
 * MessageList - Message list component (render only, no scrolling logic)
 *
 * Note: Scrolling is handled by the parent container (AppLayout.contentBody)
 * This component only renders the list of messages
 */

import type { Message } from "@/features/chat/types/chat";
import { MessageItem } from "./MessageItem";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  currentStreamingMessage: Message | null;
  showThinking: boolean;
  showTools?: boolean;
  onToggleMessageCollapse: (id: string) => void;
  onToggleThinkingCollapse: (id: string) => void;
  onToggleToolsCollapse?: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
  onRegenerateMessage?: (id: string) => void;
}

export function MessageList({
  messages,
  currentStreamingMessage,
  showThinking,
  showTools,
  onToggleMessageCollapse,
  onToggleThinkingCollapse,
  onToggleToolsCollapse,
  onDeleteMessage,
  onRegenerateMessage,
}: MessageListProps) {
  // 防止重复：如果 currentStreamingMessage 的 ID 已经在 messages 中，则不添加
  // 这发生在 finishStreaming 将消息添加到 messages 但 currentStreamingMessage 还未被设为 null 时
  const allMessages = currentStreamingMessage
    ? messages.some(m => m.id === currentStreamingMessage.id)
      ? messages  // ID 已存在于 messages 中，不重复添加
      : [...messages, currentStreamingMessage]  // ID 不存在，添加流式消息
    : messages;

  if (allMessages.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.logo}>π</div>
        <h1>Welcome to Pi Gateway</h1>
        <p>Start a conversation below</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {allMessages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          showThinking={showThinking}
          showTools={showTools}
          onToggleCollapse={() => onToggleMessageCollapse(message.id)}
          onToggleThinking={() => onToggleThinkingCollapse(message.id)}
          onToggleTools={() => onToggleToolsCollapse?.(message.id)}
          onDelete={() => onDeleteMessage?.(message.id)}
          onRegenerate={() => onRegenerateMessage?.(message.id)}
        />
      ))}
    </div>
  );
}
