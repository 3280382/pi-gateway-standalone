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

    // 获取已完成的工具 ID 集合
    const completedToolIds = new Set(activeTools.keys());

    // 已固化的内容 - tool_use 保持原样显示，通过 status 字段更新状态
    if (currentStreamingMessage.content?.length) {
      const processedContent = currentStreamingMessage.content.map((c) => {
        // 如果 content 中的 tool_use 有对应的 activeTool，更新其状态
        if (c.type === "tool_use" && c.toolCallId && completedToolIds.has(c.toolCallId)) {
          const tool = activeTools.get(c.toolCallId);
          return {
            ...c,
            status: tool?.status || (tool?.error ? "error" : tool?.output ? "success" : "executing"),
            output: tool?.output,
            error: tool?.error,
          };
        }
        // 如果 tool_use 没有对应的 activeTool，标记为 pending 状态
        if (c.type === "tool_use" && c.toolCallId && !completedToolIds.has(c.toolCallId)) {
          return {
            ...c,
            status: "pending" as const,
          };
        }
        return c;
      });
      content.push(...processedContent);
    }

    // 当前流式内容
    if (streamingThinking) {
      content.push({ type: "thinking", thinking: streamingThinking });
    }

    // 流式中的工具调用（只添加不在 content 中的）
    streamingToolCalls.forEach((tool) => {
      const existsInContent = currentStreamingMessage.content?.some(
        (c) => c.type === "tool_use" && c.toolCallId === tool.id
      );
      if (!existsInContent) {
        content.push({
          type: "tool_use",
          toolCallId: tool.id,
          toolName: tool.name,
          partialArgs: tool.args,
          status: completedToolIds.has(tool.id) ? "executing" : "pending",
        });
      }
    });

    // activeTools 只用于更新已有 tool_use 的状态，不单独添加 tool 类型
    // 结果通过更新 tool_use 的 output/error/status 字段显示

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
