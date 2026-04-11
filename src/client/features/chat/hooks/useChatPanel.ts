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
import { useChatStore } from "@/features/chat/stores/chatStore";
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

  // 消息操作
  handleSend: () => Promise<void>;
  handleBashCommand: (command: string) => void;
  handleSlashCommand: (command: string, args: string) => void;
  handleNewSession: () => Promise<void>;
}

// ===== [ANCHOR:HOOK] =====

export function useChatPanel(): UseChatPanelReturn {
  // ===== [ANCHOR:REFS] =====
  const messagesRef = useRef<HTMLDivElement>(null);

  // ===== [ANCHOR:STATE] =====
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

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
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 消息变化时自动滚动（包括流式内容变化）
  useEffect(() => {
    if (messagesRef.current && shouldScrollToBottom) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [
    messages.length,
    currentStreamingMessage,
    streamingContent,
    streamingThinking,
    shouldScrollToBottom,
  ]);

  // ===== [ANCHOR:HANDLERS] =====
  const handleScroll = useCallback(() => {
    if (messagesRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (!isAtBottom && shouldScrollToBottom) {
        setShouldScrollToBottom(false);
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
    handleSend,
    handleBashCommand,
    handleSlashCommand,
    handleNewSession,
  };
}
