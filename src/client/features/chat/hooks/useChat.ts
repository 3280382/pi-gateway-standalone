/**
 * useChat - Chat Hook for Managing Chat State and Operations
 *
 * 【职责说明】
 * 只Handle messages发送和基础操作，不处理 WebSocket 事件接收。
 *
 * 【为什么不分 WebSocket 事件处理？】
 * 1. WebSocket 事件是全局的，不应依赖Group件生命周期
 * 2. 如果放在 Hook 中，Group件卸载会导致事件处理中断
 * 3. 全局处理器在应用初始化时设置，确保不丢消息
 *
 * 【架构关系】
 * - Send message: useChat → chatWebSocket.sendChatMessage()
 * - Receive message: WebSocket → setupWebSocketListeners() → chatStore
 * - 状态读取: useChat → chatStore (React 响应式)
 *
 * 【参考】
 * setupWebSocketListeners() 在 chatApi.ts，应用初始化时调用
 */

import { useCallback } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import type { Message, ToolExecution } from "@/features/chat/types/chat";
import { websocketService } from "@/services/websocket.service";
import { sendChatMessage, abortChatGeneration } from "@/features/chat/services/chatWebSocket";

// ============================================================================
// Types
// ============================================================================

export interface UseChatReturn {
  // State
  messages: Message[];
  currentStreamingMessage: Message | null;
  inputText: string;
  isStreaming: boolean;
  showThinking: boolean;
  activeTools: Map<string, ToolExecution>;

  // Actions
  setInputText: (text: string) => void;
  sendMessage: () => void;
  abortGeneration: () => void;
  clearMessages: () => void;
  toggleMessageCollapse: (messageId: string) => void;
  toggleThinkingCollapse: (messageId: string) => void;
  setShowThinking: (show: boolean) => void;

  // Tool actions
  getToolStatus: (toolId: string) => ToolExecution | undefined;
  expandToolOutput: (toolId: string) => void;
  collapseToolOutput: (toolId: string) => void;

  // Utils
  isBashCommand: (text: string) => boolean;
  getSlashCommand: (text: string) => string | null;
}

// ============================================================================
// ID Generators
// ============================================================================

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useChat(): UseChatReturn {
  const store = useChatStore();

  // Check if text is a bash command
  const isBashCommand = useCallback((text: string): boolean => {
    return text.trimStart().startsWith("!");
  }, []);

  // Get slash command from text
  const getSlashCommand = useCallback((text: string): string | null => {
    const trimmed = text.trimStart();
    if (trimmed.startsWith("/")) {
      const match = trimmed.match(/^\/(\w+)/);
      return match ? match[1] : null;
    }
    return null;
  }, []);

  // Process input for bash/slash commands
  const processInput = useCallback(
    (text: string): { processed: string; isBash: boolean } => {
      const trimmed = text.trim();

      if (isBashCommand(trimmed)) {
        return {
          processed: trimmed.slice(1).trim(),
          isBash: true,
        };
      }

      return { processed: trimmed, isBash: false };
    },
    [isBashCommand]
  );

  // Send message
  const sendMessage = useCallback(() => {
    const text = store.inputText;
    if (!text.trim()) return;

    const { processed, isBash } = processInput(text);

    // Create user message
    const userMessage: Message = {
      id: generateMessageId(),
      role: "user",
      content: [{ type: "text", text: processed }],
      timestamp: new Date(),
    };

    // Add user message to store
    store.addMessage(userMessage);
    store.clearInput();
    store.startStreaming();

    // Send via WebSocket (使用统一的 chatWebSocket API)
    if (isBash) {
      sendChatMessage(`Execute this bash command: ${processed}`);
    } else {
      sendChatMessage(processed);
    }
  }, [store, processInput]);

  // Abort generation
  const abortGeneration = useCallback(() => {
    abortChatGeneration();
    store.abortStreaming();
  }, [store]);

  // Clear all messages
  const clearMessages = useCallback(() => {
    store.clearMessages();
  }, [store]);

  // Toggle message collapse
  const toggleMessageCollapse = useCallback(
    (messageId: string) => {
      store.toggleMessageCollapse(messageId);
    },
    [store]
  );

  // Toggle thinking collapse
  const toggleThinkingCollapse = useCallback(
    (messageId: string) => {
      store.toggleThinkingCollapse(messageId);
    },
    [store]
  );

  // Set show thinking
  const setShowThinking = useCallback(
    (show: boolean) => {
      store.setShowThinking(show);
    },
    [store]
  );

  // Set input text
  const setInputText = useCallback(
    (text: string) => {
      store.setInputText(text);
    },
    [store]
  );

  // Get tool status
  const getToolStatus = useCallback(
    (toolId: string): ToolExecution | undefined => {
      return store.activeTools.get(toolId);
    },
    [store.activeTools]
  );

  // Expand tool output
  const expandToolOutput = useCallback((toolId: string) => {
    // 工具Expand状态在Group件本地管理
    console.log("[useChat] expand tool:", toolId);
  }, []);

  // Collapse tool output
  const collapseToolOutput = useCallback((toolId: string) => {
    // 工具Collapse状态在Group件本地管理
    console.log("[useChat] collapse tool:", toolId);
  }, []);

  return {
    // State
    messages: store.messages,
    currentStreamingMessage: store.currentStreamingMessage,
    inputText: store.inputText,
    isStreaming: store.isStreaming,
    showThinking: store.showThinking,
    activeTools: store.activeTools,

    // Actions
    setInputText,
    sendMessage,
    abortGeneration,
    clearMessages,
    toggleMessageCollapse,
    toggleThinkingCollapse,
    setShowThinking,

    // Tool actions
    getToolStatus,
    expandToolOutput,
    collapseToolOutput,

    // Utils
    isBashCommand,
    getSlashCommand,
  };
}

// ============================================================================
// Re-export types
// ============================================================================

export type { Message, MessageContent, ToolExecution };
