/**
 * MessageList - Message list component
 *
 * 【设计原则 - 重要】
 * 1. 历史消息只渲染一次：messages 数组从 props 传入，只有在 session 切换或加载更多时才会变化
 * 2. 流式过程不触发历史消息重渲染：流式状态（streamingContent, streamingThinking 等）通过 props 传入，
 *    在 useStreamingMessage hook 中本地合并显示，不修改 messages 数组
 * 3. 唯一触发历史消息重渲染的情况：
 *    - 搜索过滤（searchFilters 变化）→ 过滤在 ChatPanel.tsx 的 filterMessages() 中完成
 * 4. 服务器返回的消息已经是最终格式，客户端不做复杂转换
 *
 * Performance optimization:
 * - Static messages are passed via props and only re-render when messages array changes
 * - Streaming state is passed via props, not subscribed directly from store
 * - MessageItem is memoized to prevent unnecessary re-renders of static messages
 *
 * 【警告】修改此组件时需特别注意：
 * - 不要添加会导致 messages 数组频繁变化的逻辑
 * - 流式更新应该只影响 currentStreamingMessage，不影响已固化的 messages
 */

import { memo, useMemo, useRef } from "react";
import type {
  ChatSearchFilters,
  Message,
  MessageContent,
  ToolExecution,
} from "@/features/chat/types/chat";
import { MessageItem } from "./MessageItem";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  currentStreamingMessage: Message | null;
  showThinking: boolean;
  showTools?: boolean;
  searchFilters?: ChatSearchFilters;
  onToggleMessageCollapse: (id: string) => void;
  onToggleThinkingCollapse: (id: string) => void;
  onToggleToolsCollapse?: (id: string) => void;
  // Streaming state - passed from parent to control re-render frequency
  streamingContent?: string;
  streamingThinking?: string;
  streamingToolCalls?: Map<string, { id: string; name: string; args: string }>;
  activeTools?: Map<string, ToolExecution>;
}

// Memoized static message item - only re-renders when message changes
const StaticMessageItem = memo(function StaticMessageItem({
  message,
  showThinking,
  showTools,
  showText,
  searchFilters,
  onToggleCollapse,
  onToggleThinking,
  onToggleTools,
}: {
  message: Message;
  showThinking: boolean;
  showTools: boolean;
  showText: boolean;
  searchFilters?: ChatSearchFilters;
  onToggleCollapse: () => void;
  onToggleThinking: () => void;
  onToggleTools?: () => void;
}) {
  return (
    <MessageItem
      message={message}
      showThinking={showThinking}
      showTools={showTools}
      showText={showText}
      searchFilters={searchFilters}
      onToggleCollapse={onToggleCollapse}
      onToggleThinking={onToggleThinking}
      onToggleTools={onToggleTools}
    />
  );
});

// Build streaming message content
function useStreamingMessage(
  currentStreamingMessage: Message | null,
  streamingContent: string,
  streamingThinking: string,
  streamingToolCalls: Map<string, { id: string; name: string; args: string }>,
  activeTools: Map<string, ToolExecution>
): Message | null {
  return useMemo(() => {
    if (!currentStreamingMessage) return null;

    const content: MessageContent[] = [];
    const completedToolIds = new Set(activeTools.keys());

    // Process solidified content
    console.log(
      "[useStreamingMessage] Processing content blocks:",
      currentStreamingMessage.content?.length
    );
    if (currentStreamingMessage.content?.length) {
      const processedContent = currentStreamingMessage.content.map((c, index) => {
        console.log(
          `[useStreamingMessage] Block ${index}: type=${c.type}, toolCallId=${(c as any).toolCallId}`
        );
        if (c.type === "tool_use" && c.toolCallId && completedToolIds.has(c.toolCallId)) {
          const tool = activeTools.get(c.toolCallId);
          console.log(
            `[useStreamingMessage] Found matching tool for ${c.toolCallId}:`,
            tool ? `output=${!!tool.output}` : "not found"
          );
          return {
            ...c,
            status:
              tool?.status || (tool?.error ? "error" : tool?.output ? "success" : "executing"),
            output: tool?.output,
            error: tool?.error,
          };
        }
        if (c.type === "tool_use" && c.toolCallId && !completedToolIds.has(c.toolCallId)) {
          return { ...c, status: "pending" as const };
        }
        if (c.type === "tool_use" && !c.toolCallId) {
          const toolCallIds = Array.from(streamingToolCalls.keys());
          const matchedToolCallId = toolCallIds[index];
          if (matchedToolCallId && completedToolIds.has(matchedToolCallId)) {
            const tool = activeTools.get(matchedToolCallId);
            return {
              ...c,
              toolCallId: matchedToolCallId,
              status:
                tool?.status || (tool?.error ? "error" : tool?.output ? "success" : "executing"),
              output: tool?.output,
              error: tool?.error,
            };
          }
        }
        return c;
      });
      content.push(...processedContent);
    }

    // Current streaming content
    if (streamingThinking) {
      content.push({ type: "thinking", thinking: streamingThinking });
    }

    // Tool calls in streaming - skip if already in solidified content
    streamingToolCalls.forEach((tool) => {
      const existingIndex = content.findIndex(
        (c) => (c.type === "tool_use" || c.type === "tool") && c.toolCallId === tool.id
      );
      const activeTool = activeTools.get(tool.id);

      if (existingIndex >= 0) {
        if (activeTool?.output || activeTool?.error) {
          content[existingIndex] = {
            ...content[existingIndex],
            status: activeTool.status || (activeTool.error ? "error" : "success"),
            output: activeTool.output,
            error: activeTool.error,
          };
        }
      } else {
        content.push({
          type: "tool_use",
          toolCallId: tool.id,
          toolName: tool.name,
          partialArgs: tool.args,
          status: activeTool?.status || (completedToolIds.has(tool.id) ? "executing" : "pending"),
          output: activeTool?.output,
          error: activeTool?.error,
        });
      }
    });

    // Completed tools not in streaming - skip if already in content
    console.log(
      "[useStreamingMessage] activeTools count:",
      activeTools.size,
      "ids:",
      Array.from(activeTools.keys())
    );
    activeTools.forEach((tool) => {
      const existsInContent = content.some(
        (c) => (c.type === "tool_use" || c.type === "tool") && c.toolCallId === tool.id
      );
      console.log(
        "[useStreamingMessage] Processing tool:",
        tool.id,
        "exists:",
        existsInContent,
        "output:",
        !!tool.output,
        "error:",
        !!tool.error
      );
      if (!existsInContent) {
        content.push({
          type: "tool_use",
          toolCallId: tool.id,
          toolName: tool.name,
          args: tool.args,
          status: tool.status || (tool.error ? "error" : "success"),
          output: tool.output,
          error: tool.error,
        });
        console.log("[useStreamingMessage] Added tool to content:", tool.id);
      }
    });

    if (streamingContent) {
      content.push({ type: "text", text: streamingContent });
    }

    return { ...currentStreamingMessage, content };
  }, [
    currentStreamingMessage,
    streamingContent,
    streamingThinking,
    streamingToolCalls,
    activeTools,
  ]);
}

export const MessageList = memo(function MessageList({
  messages,
  currentStreamingMessage,
  showThinking,
  showTools,
  searchFilters,
  onToggleMessageCollapse,
  onToggleThinkingCollapse,
  onToggleToolsCollapse,
  streamingContent = "",
  streamingThinking = "",
  streamingToolCalls = new Map(),
  activeTools = new Map(),
}: MessageListProps) {
  const renderCount = useRef(0);
  renderCount.current++;

  // Compute content block visibility based on showThinking/showTools settings
  // Note: Message-level filtering is done in ChatPanel.tsx via filterMessages()
  const { effectiveShowText, effectiveShowThinking, effectiveShowTools } = useMemo(() => {
    return {
      effectiveShowText: true,
      effectiveShowThinking: showThinking,
      effectiveShowTools: showTools ?? true,
    };
  }, [showThinking, showTools]);

  // Build streaming message
  const streamingMessageWithContent = useStreamingMessage(
    currentStreamingMessage,
    streamingContent,
    streamingThinking,
    streamingToolCalls,
    activeTools
  );

  // Memoize handlers to prevent unnecessary re-renders of static messages
  const handlers = useMemo(() => {
    return messages.map((message) => ({
      onToggleCollapse: () => onToggleMessageCollapse(message.id),
      onToggleThinking: () => onToggleThinkingCollapse(message.id),
      onToggleTools: onToggleToolsCollapse ? () => onToggleToolsCollapse(message.id) : undefined,
    }));
  }, [messages, onToggleMessageCollapse, onToggleThinkingCollapse, onToggleToolsCollapse]);

  if (messages.length === 0 && !streamingMessageWithContent) {
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
      {messages.map((message, index) => (
        <StaticMessageItem
          key={message.id}
          message={message}
          showThinking={effectiveShowThinking}
          showTools={effectiveShowTools}
          showText={effectiveShowText}
          searchFilters={searchFilters}
          onToggleCollapse={handlers[index].onToggleCollapse}
          onToggleThinking={handlers[index].onToggleThinking}
          onToggleTools={handlers[index].onToggleTools}
        />
      ))}
      {streamingMessageWithContent && (
        <MessageItem
          message={streamingMessageWithContent}
          showThinking={effectiveShowThinking}
          showTools={effectiveShowTools}
          showText={effectiveShowText}
          searchFilters={searchFilters}
          onToggleCollapse={() => onToggleMessageCollapse(streamingMessageWithContent.id)}
          onToggleThinking={() => onToggleThinkingCollapse(streamingMessageWithContent.id)}
          onToggleTools={
            onToggleToolsCollapse
              ? () => onToggleToolsCollapse(streamingMessageWithContent.id)
              : undefined
          }
        />
      )}
    </div>
  );
});
