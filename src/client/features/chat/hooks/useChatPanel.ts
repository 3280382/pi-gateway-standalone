/**
 * useChatPanel - ChatPanel 组件业务逻辑 Hook
 *
 * 职责：
 * - 管理消息列表自动滚动逻辑
 * - 处理消息发送协调
 * - 处理 bash/slash 命令
 * - 管理新会话创建
 */

// ===== [ANCHOR:IMPORTS] =====

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatController } from "@/features/chat/services/api/chatApi";
import { loadMoreMessages } from "@/features/chat/services/chatWebSocket";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import type { Message } from "@/features/chat/types/chat";

// ===== [ANCHOR:HELPERS] =====

function createUserMessage(text: string): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: "user",
    content: [{ type: "text", text }],
    timestamp: new Date(),
  };
}

function createSystemMessage(text: string): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: "system",
    content: [{ type: "text", text }],
    timestamp: new Date(),
  };
}

function createErrorMessage(error: unknown): Message {
  const errorText = error instanceof Error ? error.message : String(error);
  return createSystemMessage(`命令执行失败: ${errorText}`);
}

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
    const resultText = result?.output || result?.error || "命令执行完成";
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

  // 加载更多消息
  isLoadingMore: boolean;
  hasMoreMessages: boolean;
  loadMore: () => void;
  reloadAllMessages: () => void;

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
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  // ===== [ANCHOR:STATE] =====
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // ===== [ANCHOR:STORE_SELECTORS] =====
  const inputText = useChatStore((state) => state.inputText);
  const messages = useChatStore((state) => state.messages);
  const currentStreamingMessage = useChatStore((state) => state.currentStreamingMessage);
  const streamingContent = useChatStore((state) => state.streamingContent);
  const streamingThinking = useChatStore((state) => state.streamingThinking);
  const chatController = useChatController();

  // ===== [ANCHOR:EFFECTS] =====
  // 首次加载时滚动到底部
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        lastScrollTimeRef.current = Date.now();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 消息变化时自动滚动（包括流式内容变化）
  useEffect(() => {
    if (messagesRef.current && shouldScrollToBottom) {
      // 防抖滚动：避免在短时间内频繁滚动
      const now = Date.now();
      const timeSinceLastScroll = now - lastScrollTimeRef.current;

      // 如果距离上次滚动超过100ms，立即滚动；否则延迟滚动
      if (timeSinceLastScroll > 100) {
        // 立即滚动
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        lastScrollTimeRef.current = now;
      } else {
        // 延迟滚动，合并频繁的更新
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          if (messagesRef.current && shouldScrollToBottom) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
            lastScrollTimeRef.current = Date.now();
          }
          scrollTimeoutRef.current = null;
        }, 50); // 50ms延迟，足够合并快速更新
      }
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [shouldScrollToBottom, messages, streamingContent, streamingThinking]); // 添加流式内容依赖

  // 当切换 session 或消息列表清空时，自动启用滚屏
  useEffect(() => {
    if (messages.length === 0) {
      setShouldScrollToBottom(true);
    }
  }, [messages.length]);

  // 监听 more_messages_loaded 事件
  useEffect(() => {
    const unsubscribe = useChatStore.subscribe((state) => {
      // 检查是否有新加载的消息（通过消息数量变化判断）
      const currentMessages = state.messages;
      if (currentMessages.length > 0 && loadingMoreRef.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ===== [ANCHOR:HANDLERS] =====
  const handleScroll = useCallback(() => {
    if (messagesRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      const isAtTop = scrollTop < 50; // 距离顶部50px内认为是顶部

      if (!isAtBottom && shouldScrollToBottom) {
        setShouldScrollToBottom(false);
      }

      // 滚动到顶部时自动加载更多消息
      if (isAtTop && hasMoreRef.current && !loadingMoreRef.current) {
        loadMore();
      }
    }
  }, [shouldScrollToBottom]);

  // 加载更多消息
  const loadMore = useCallback(() => {
    const sessionStore = useSessionStore.getState();
    const currentSessionFile = sessionStore.currentSessionFile;

    if (!currentSessionFile || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    const currentMessages = useChatStore.getState().messages;
    const offset = currentMessages.length;

    console.log(`[useChatPanel] Loading more messages from offset ${offset}`);

    const success = loadMoreMessages(currentSessionFile, offset, 50);

    if (!success) {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }

    // 5秒后重置加载状态（防止卡住）
    setTimeout(() => {
      if (loadingMoreRef.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }, 5000);
  }, []);

  // 重新加载所有消息
  const reloadAllMessages = useCallback(() => {
    const sessionStore = useSessionStore.getState();
    const chatStore = useChatStore.getState();
    const currentSessionFile = sessionStore.currentSessionFile;

    if (!currentSessionFile) return;

    // 清空当前消息，触发重新加载
    chatStore.setMessages([]);
    hasMoreRef.current = true;
    setHasMoreMessages(true);

    // 使用 -1 表示加载所有
    loadMoreMessages(currentSessionFile, 0, -1);
    console.log("[useChatPanel] Reloading all messages");
  }, []);

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

      if (command === "clear" || command === "new") {
        chatController.clearMessages();
        return;
      }

      if (
        command !== "bash" &&
        command !== "read" &&
        command !== "write" &&
        command !== "edit" &&
        command !== "ls" &&
        command !== "grep" &&
        command !== "tree" &&
        command !== "git"
      ) {
        chatController.sendMessage(`/${command} ${args}`.trim());
        return;
      }

      const isNoArgsCommand = command === "ls" || command === "tree";
      if (!args && !isNoArgsCommand) return;

      const cmdText = args ? `/${command} ${args}` : `/${command}`;
      const executeCmd = cmdText.replace(/^\//, "");

      executeCommandWithMessages(executeCmd, cmdText, chatController.executeCommand);
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
    isLoadingMore,
    hasMoreMessages,
    loadMore,
    reloadAllMessages,
    handleSend,
    handleSendWithImages,
    handleBashCommand,
    handleSlashCommand,
    handleNewSession,
  };
}
