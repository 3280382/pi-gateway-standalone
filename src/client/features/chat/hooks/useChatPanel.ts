/**
 * useChatPanel - ChatPanel Group件业务逻辑 Hook
 *
 * Responsibilities:
 * - 管理消息Cols表自动滚动逻辑
 * - Handle messages发送协调
 * - 处理 bash/slash Command
 * - 管理新会话创建
 */

// ===== [ANCHOR:IMPORTS] =====

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatController } from "@/features/chat/services/api/chatApi";

import { useChatStore } from "@/features/chat/stores/chatStore";
import {
  createErrorMessage,
  createSystemMessage,
  createUserMessage,
} from "@/features/chat/utils/messageUtils";

// ===== [ANCHOR:COMMAND_EXECUTION] =====

async function executeCommandWithMessages(
  command: string,
  displayText: string,
  executeFn: (cmd: string) => Promise<any>
): Promise<void> {
  const chatStore = useChatStore.getState();

  // 添加用户输入消息
  chatStore.addMessage(createUserMessage(displayText));

  try {
    const result = await executeFn(command);
    const resultText = result?.output || result?.error || "Command execution complete";
    chatStore.addMessage(createSystemMessage(resultText));
  } catch (err) {
    chatStore.addMessage(createErrorMessage(err));
  }
}

// ===== [ANCHOR:TYPES] =====

export interface UseChatPanelReturn {
  // Refs
  messagesRef: React.RefObject<HTMLDivElement | null>;

  // 滚动相关
  shouldScrollToBottom: boolean;
  setShouldScrollToBottom: (value: boolean) => void;
  handleScroll: () => void;

  // 消息操作
  handleSend: () => Promise<void>;
  handleSendWithImages: (
    text: string,
    images: Array<{
      type: "image";
      source: { type: "base64"; mediaType: string; data: string };
    }>
  ) => Promise<void>;
  handleBashCommand: (command: string) => void;
  handleSlashCommand: (command: string, args: string) => void;
  handleNewSession: () => Promise<void>;
}

// ===== [ANCHOR:HOOK] =====

export function useChatPanel(): UseChatPanelReturn {
  // ===== [ANCHOR:REFS] =====
  const messagesRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTimeRef = useRef(0);
  // ===== [ANCHOR:STATE] =====
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

  // ===== [ANCHOR:STORE_SELECTORS] =====
  const inputText = useChatStore((state) => state.inputText);
  const messages = useChatStore((state) => state.messages);
  const isStreaming = useChatStore((state) => state.isStreaming);

  const chatController = useChatController();

  // ===== [ANCHOR:SCROLL_LOGIC] =====
  const performScroll = useCallback(() => {
    if (!messagesRef.current || !shouldScrollToBottom) return;

    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTimeRef.current;

    if (timeSinceLastScroll > 100) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      lastScrollTimeRef.current = now;
    } else {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        if (messagesRef.current && shouldScrollToBottom) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
          lastScrollTimeRef.current = Date.now();
        }
        scrollTimeoutRef.current = null;
      }, 50);
    }
  }, [shouldScrollToBottom]);

  // ===== [ANCHOR:EFFECTS] =====
  // 首次加载时滚动到底部（延迟等待 DOM 渲染和消息加载）
  useEffect(() => {
    const timer = setTimeout(() => {
      performScroll();
    }, 100);

    return () => clearTimeout(timer);
  }, [performScroll]);

  // 消息数量变化时自动滚动（刷新页面、session 切换、新发送消息）
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length is intentionally used as a trigger
  useEffect(() => {
    performScroll();
  }, [messages.length, performScroll]);

  // 激活滚动按钮时立即滚动到底部
  useEffect(() => {
    if (shouldScrollToBottom) {
      performScroll();
    }
  }, [shouldScrollToBottom, performScroll]);

  // 流式过程中持续滚动（AI 回复时内容持续更新，messages 长度不变）
  useEffect(() => {
    if (!isStreaming || !shouldScrollToBottom || !messagesRef.current) return;

    const interval = setInterval(() => {
      if (messagesRef.current && shouldScrollToBottom) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isStreaming, shouldScrollToBottom]);

  // ===== [ANCHOR:HANDLERS] =====
  const handleScroll = useCallback(() => {
    if (messagesRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (!isAtBottom && shouldScrollToBottom) {
        setShouldScrollToBottom(false);
      } else if (isAtBottom && !shouldScrollToBottom) {
        setShouldScrollToBottom(true);
      }
    }
  }, [shouldScrollToBottom]);

  const handleSend = useCallback(async () => {
    if (inputText.trim()) {
      setShouldScrollToBottom(true);
      try {
        await chatController.sendMessage(inputText);
      } catch (err) {
        console.error("[useChatPanel] sendMessage failed:", err);
      }
    }
  }, [inputText, chatController]);

  const handleSendWithImages = useCallback(
    async (
      text: string,
      images: Array<{
        type: "image";
        source: { type: "base64"; mediaType: string; data: string };
      }>
    ) => {
      if (text.trim() || images.length > 0) {
        setShouldScrollToBottom(true);
        try {
          await chatController.sendMessage(text, images);
        } catch (err) {
          console.error("[useChatPanel] sendMessage with images failed:", err);
        }
      }
    },
    [chatController]
  );

  const handleBashCommand = useCallback(
    (command: string) => {
      setShouldScrollToBottom(true);
      executeCommandWithMessages(command, `!${command}`, chatController.executeCommand);
    },
    [chatController]
  );

  const handleSlashCommand = useCallback(
    (command: string, args: string) => {
      setShouldScrollToBottom(true);

      // Build full command text
      const cmdText = args ? `/${command} ${args}` : `/${command}`;

      // Handle UI-only commands
      if (command === "clear" || command === "new") {
        chatController.clearMessages();
        return;
      }

      // Unknown command - send to LLM as regular text (no longer processing /compact /export here)
      chatController.sendMessage(cmdText);
    },
    [chatController]
  );

  const handleNewSession = useCallback(async () => {
    setShouldScrollToBottom(true);
    await chatController.createNewSession();
  }, [chatController]);

  // ===== [ANCHOR:RETURN] =====
  return {
    messagesRef,
    shouldScrollToBottom,
    setShouldScrollToBottom,
    handleScroll,
    handleSend,
    handleSendWithImages,
    handleBashCommand,
    handleSlashCommand,
    handleNewSession,
  };
}
