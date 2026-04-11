/**
 * MessageList - Message list component
 */

import { useMemo } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import type { Message, MessageContent } from "@/features/chat/types/chat";
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
  // 获取流式状态和工具状态
  const streamingContent = useChatStore((state) => state.streamingContent);
  const streamingThinking = useChatStore((state) => state.streamingThinking);
  const streamingToolCalls = useChatStore((state) => state.streamingToolCalls);
  const activeTools = useChatStore((state) => state.activeTools);

  // 构建流式消息内容
  const streamingMessageWithContent = useMemo(() => {
    if (!currentStreamingMessage) return null;

    const content: MessageContent[] = [];

    // 已固化的内容
    if (currentStreamingMessage.content?.length) {
      content.push(...currentStreamingMessage.content);
    }

    // 当前流式内容
    if (streamingThinking) {
      content.push({ type: "thinking", thinking: streamingThinking });
    }

    // 流式中的工具调用
    streamingToolCalls.forEach((tool) => {
      content.push({
        type: "tool_use",
        toolCallId: tool.id,
        toolName: tool.name,
        partialArgs: tool.args,
      });
    });

    // 已完成的工具调用（包含结果）
    activeTools.forEach((tool) => {
      content.push({
        type: "tool",
        toolCallId: tool.id,
        toolName: tool.name,
        args: tool.args,
        output: tool.output,
        error: tool.error,
      });
    });

    if (streamingContent) {
      content.push({ type: "text", text: streamingContent });
    }

    return {
      ...currentStreamingMessage,
      content,
    };
  }, [
    currentStreamingMessage,
    streamingContent,
    streamingThinking,
    streamingToolCalls,
    activeTools,
  ]);

  // 合并所有消息
  const allMessages = useMemo(() => {
    if (!streamingMessageWithContent) return messages;

    // 检查是否已存在
    const exists = messages.some((m) => m.id === streamingMessageWithContent.id);
    if (exists) return messages;

    return [...messages, streamingMessageWithContent];
  }, [messages, streamingMessageWithContent]);

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
