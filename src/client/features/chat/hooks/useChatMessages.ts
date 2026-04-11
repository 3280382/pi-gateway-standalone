/**
 * useChatMessages - 聊天消息处理 Hook
 * 处理消息过滤和搜索
 */

import { useMemo } from "react";
import { filterMessages, useChatStore } from "@/features/chat/stores/chatStore";

export interface UseChatMessagesReturn {
  // 消息列表
  messages: ReturnType<typeof useChatStore.getState>["messages"];
  filteredMessages: ReturnType<typeof useChatStore.getState>["messages"];
  currentStreamingMessage: ReturnType<typeof useChatStore.getState>["currentStreamingMessage"];

  // UI 状态
  showThinking: boolean;

  // 操作
  toggleMessageCollapse: (messageId: string) => void;
  toggleThinkingCollapse: (messageId: string) => void;
  toggleToolsCollapse: (messageId: string) => void;
}

export function useChatMessages(): UseChatMessagesReturn {
  // 基础状态
  const messages = useChatStore((s) => s.messages);
  const currentStreamingMessage = useChatStore((s) => s.currentStreamingMessage);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleMessageCollapse = useChatStore((s) => s.toggleMessageCollapse);
  const toggleThinkingCollapse = useChatStore((s) => s.toggleThinkingCollapse);
  const toggleToolsCollapse = useChatStore((s) => s.toggleToolsCollapse);

  // 搜索过滤
  const searchQuery = useChatStore((s) => s.searchQuery);
  const searchFilters = useChatStore((s) => s.searchFilters);

  const filteredMessages = useMemo(() => {
    return filterMessages(messages, {
      query: searchQuery,
      filters: searchFilters,
    });
  }, [messages, searchQuery, searchFilters]);

  return {
    messages,
    filteredMessages,
    currentStreamingMessage,
    showThinking,
    toggleMessageCollapse,
    toggleThinkingCollapse,
    toggleToolsCollapse,
  };
}
