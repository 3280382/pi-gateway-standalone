/**
 * MessageList - Message list component
 */

import { useMemo } from "react";
import { useChatStore, selectSearchFilters } from "@/features/chat/stores/chatStore";
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
  console.log("[MessageList] Rendering with messages:", messages.length);
  
  // Get streaming and tool status
  const streamingContent = useChatStore((state) => state.streamingContent);
  const streamingThinking = useChatStore((state) => state.streamingThinking);
  const streamingToolCalls = useChatStore((state) => state.streamingToolCalls);
  const activeTools = useChatStore((state) => state.activeTools);
  
  // Get search filters for hierarchical content filtering
  const searchFilters = useChatStore(selectSearchFilters);
  
  // Compute visible content types based on active filters
  const { visibleContentTypes, effectiveShowText, effectiveShowThinking, effectiveShowTools } = useMemo(() => {
    // Default: show all content types
    const defaultTypes = new Set(["prompt", "text", "thinking", "tool", "compaction", "retry", "autoRetry", "modelChange", "thinkingLevelChange", "usage"]);
    
    // If no filters or all filters active, show everything
    const { roles, contentTypes } = searchFilters || {};
    if (!roles || !contentTypes) {
      return {
        visibleContentTypes: defaultTypes,
        effectiveShowText: true,
        effectiveShowThinking: showThinking,
        effectiveShowTools: showTools ?? true,
      };
    }
    
    // Build set of visible content types based on active role + content type combination
    const visible = new Set<string>();
    
    if (roles.user && contentTypes.prompt) {
      visible.add("prompt");
    }
    if (roles.assistant) {
      if (contentTypes.text) visible.add("text");
      if (contentTypes.thinking) visible.add("thinking");
      // Add tool status variants
      if (contentTypes.tool) {
        visible.add("tool");
        if (contentTypes.toolSuccess) visible.add("toolSuccess");
        if (contentTypes.toolError) visible.add("toolError");
        if (contentTypes.toolPending) visible.add("toolPending");
      }
    }
    if (roles.system) {
      if (contentTypes.compaction) visible.add("compaction");
      if (contentTypes.retry) visible.add("retry");
      if (contentTypes.autoRetry) visible.add("autoRetry");
      if (contentTypes.modelChange) visible.add("modelChange");
      if (contentTypes.thinkingLevelChange) visible.add("thinkingLevelChange");
      if (contentTypes.usage) visible.add("usage");
    }
    
    return {
      visibleContentTypes: visible,
      effectiveShowText: roles.assistant && contentTypes.text,
      effectiveShowThinking: showThinking && roles.assistant && contentTypes.thinking,
      effectiveShowTools: (showTools ?? true) && roles.assistant && contentTypes.tool,
    };
  }, [searchFilters, showThinking, showTools]);

  // Build streaming message content
  const streamingMessageWithContent = useMemo(() => {
    if (!currentStreamingMessage) return null;

    const content: MessageContent[] = [];

    // Get completed tool ID set
    const completedToolIds = new Set(activeTools.keys());

    // Solidified content - tool_use display as-is，update status via status field
    if (currentStreamingMessage.content?.length) {
      const processedContent = currentStreamingMessage.content.map((c) => {
        // If tool_use in content has activeTool，update its status
        if (c.type === "tool_use" && c.toolCallId && completedToolIds.has(c.toolCallId)) {
          const tool = activeTools.get(c.toolCallId);
          return {
            ...c,
            status: tool?.status || (tool?.error ? "error" : tool?.output ? "success" : "executing"),
            output: tool?.output,
            error: tool?.error,
          };
        }
        // If tool_use has no activeTool，mark as pending status
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

    // Current streaming content
    if (streamingThinking) {
      content.push({ type: "thinking", thinking: streamingThinking });
    }

    // Tool calls in streaming（only add those not in content，or update existing）
    streamingToolCalls.forEach((tool) => {
      const existingIndex = content.findIndex(
        (c) => c.type === "tool_use" && c.toolCallId === tool.id
      );
      const activeTool = activeTools.get(tool.id);
      
      if (existingIndex >= 0) {
        // Update existing tool_use, add output
        if (activeTool?.output || activeTool?.error) {
          content[existingIndex] = {
            ...content[existingIndex],
            status: activeTool.status || (activeTool.error ? "error" : "success"),
            output: activeTool.output,
            error: activeTool.error,
          };
        }
      } else {
        // 添加新的 tool_use
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

    // activeTools 中不在 streamingToolCalls 的已完成工具也显示
    activeTools.forEach((tool) => {
      const existsInContent = content.some(
        (c) => c.type === "tool_use" && c.toolCallId === tool.id
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
      }
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
          showThinking={effectiveShowThinking}
          showTools={effectiveShowTools}
          showText={effectiveShowText}
          visibleContentTypes={visibleContentTypes}
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
