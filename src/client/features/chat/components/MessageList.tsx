/**
 * MessageList - Message list component
 *
 * 【设计原则 - 重要】
 * 1. 历史消息只渲染一次：messages 数组从 props 传入，只有在 session 切换或加载更多时才会变化
 * 2. 流式过程不触发历史消息重渲染：流式状态（streamingContent, streamingThinking 等）通过 props 传入，
 *    在 useStreamingMessage hook 中本地合并显示，不修改 messages 数组
 * 3. 唯一触发历史消息重渲染的情况：
 *    - 搜索过滤（searchFilters 变化）
 *    - 内容类型过滤（visibleContentTypes 变化）
 *    - 加载更多消息（prependMessages）
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

import { useMemo, memo, useRef, useEffect } from "react";
import { useChatStore, selectSearchFilters } from "@/features/chat/stores/chatStore";
import type { Message, MessageContent, ToolExecution } from "@/features/chat/types/chat";
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
  visibleContentTypes,
  onToggleCollapse,
  onToggleThinking,
  onToggleTools,
  onDelete,
  onRegenerate,
}: {
  message: Message;
  showThinking: boolean;
  showTools: boolean;
  showText: boolean;
  visibleContentTypes: Set<string>;
  onToggleCollapse: () => void;
  onToggleThinking: () => void;
  onToggleTools?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
}) {
  return (
    <MessageItem
      message={message}
      showThinking={showThinking}
      showTools={showTools}
      showText={showText}
      visibleContentTypes={visibleContentTypes}
      onToggleCollapse={onToggleCollapse}
      onToggleThinking={onToggleThinking}
      onToggleTools={onToggleTools}
      onDelete={onDelete}
      onRegenerate={onRegenerate}
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

    // Tool calls in streaming
    streamingToolCalls.forEach((tool) => {
      const existingIndex = content.findIndex(
        (c) => c.type === "tool_use" && c.toolCallId === tool.id
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

    // Completed tools not in streaming
    console.log(
      "[useStreamingMessage] activeTools count:",
      activeTools.size,
      "ids:",
      Array.from(activeTools.keys())
    );
    activeTools.forEach((tool) => {
      const existsInContent = content.some(
        (c) => c.type === "tool_use" && c.toolCallId === tool.id
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
  onToggleMessageCollapse,
  onToggleThinkingCollapse,
  onToggleToolsCollapse,
  onDeleteMessage,
  onRegenerateMessage,
  streamingContent = "",
  streamingThinking = "",
  streamingToolCalls = new Map(),
  activeTools = new Map(),
}: MessageListProps) {
  const renderCount = useRef(0);
  renderCount.current++;
  // Get search filters for hierarchical content filtering
  const searchFilters = useChatStore(selectSearchFilters);

  // Compute visible content types based on new 3-level filters
  const { visibleContentTypes, effectiveShowText, effectiveShowThinking, effectiveShowTools } =
    useMemo(() => {
      // Default: show all (using snake_case to match server data)
      const defaultTypes = new Set([
        "user",
        "assistant",
        "sysinfo",
        "prompt",
        "response",
        "thinking",
        "tool",
        "event",
        "model_change",
        "thinking_level_change",
        "compaction",
        "usage",
        "retry",
        "auto_retry",
        "tool_call",
        "tool_result",
        "text_prompt",
        "text_response",
        "thinking_block",
      ]);

      const { kind1, kind2, kind3 } = searchFilters || {};
      if (!kind1 || !kind2 || !kind3) {
        return {
          visibleContentTypes: defaultTypes,
          effectiveShowText: true,
          effectiveShowThinking: showThinking,
          effectiveShowTools: showTools ?? true,
        };
      }

      const visible = new Set<string>();

      // Level 1: user | assistant | sysinfo
      if (kind1.user) visible.add("user");
      if (kind1.assistant) visible.add("assistant");
      if (kind1.sysinfo) visible.add("sysinfo");

      // Level 2: prompt | response | thinking | tool | event
      if (kind2.prompt) visible.add("prompt");
      if (kind2.response) visible.add("response");
      if (kind2.thinking) visible.add("thinking");
      if (kind2.tool) visible.add("tool");
      if (kind2.event) visible.add("event");

      // Level 3: specific subtypes (snake_case to match server)
      if (kind3.modelChange) visible.add("model_change");
      if (kind3.thinkingLevelChange) visible.add("thinking_level_change");
      if (kind3.compaction) visible.add("compaction");
      if (kind3.usage) visible.add("usage");
      if (kind3.retry) visible.add("retry");
      if (kind3.autoRetry) visible.add("auto_retry");
      if (kind3.toolSuccess) visible.add("tool_success");
      if (kind3.toolError) visible.add("tool_error");
      if (kind3.toolPending) visible.add("tool_pending");

      // Always allow common assistant/user subtypes (they follow kind1/kind2 filtering)
      visible.add("thinking_block");
      visible.add("text_response");
      visible.add("text_prompt");
      visible.add("tool_call");
      visible.add("tool_result");

      return {
        visibleContentTypes: visible,
        effectiveShowText: kind1.assistant && kind2.response,
        effectiveShowThinking: showThinking && kind1.assistant && kind2.thinking,
        effectiveShowTools: (showTools ?? true) && kind1.assistant && kind2.tool,
      };
    }, [searchFilters, showThinking, showTools]);

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
      onDelete: onDeleteMessage ? () => onDeleteMessage(message.id) : undefined,
      onRegenerate: onRegenerateMessage ? () => onRegenerateMessage(message.id) : undefined,
    }));
  }, [
    messages,
    onToggleMessageCollapse,
    onToggleThinkingCollapse,
    onToggleToolsCollapse,
    onDeleteMessage,
    onRegenerateMessage,
  ]);

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
          visibleContentTypes={visibleContentTypes}
          onToggleCollapse={handlers[index].onToggleCollapse}
          onToggleThinking={handlers[index].onToggleThinking}
          onToggleTools={handlers[index].onToggleTools}
          onDelete={handlers[index].onDelete}
          onRegenerate={handlers[index].onRegenerate}
        />
      ))}
      {streamingMessageWithContent && (
        <MessageItem
          message={streamingMessageWithContent}
          showThinking={effectiveShowThinking}
          showTools={effectiveShowTools}
          showText={effectiveShowText}
          visibleContentTypes={visibleContentTypes}
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
