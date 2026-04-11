/**
 * ChatPanel - Main Chat Container
 *
 * 职责：
 * - 负责聊天面板的整体布局
 * - 协调 MessageList 和 InputArea 组件
 * - 不包含业务逻辑，只负责视图组合
 */

// ===== [ANCHOR:IMPORTS] =====

import { useChatPanel } from "@/features/chat/hooks/useChatPanel";
import { useChatController } from "@/features/chat/services/api/chatApi";
import {
  filterMessages,
  selectCurrentStreamingMessage,
  selectInputText,
  selectIsStreaming,
  selectMessages,
  selectSearchFilters,
  selectSearchQuery,
  selectShowThinking,
  useChatStore,
} from "@/features/chat/stores/chatStore";
import styles from "./ChatPanel.module.css";
import { InputArea } from "./InputArea";
import { MessageList } from "./MessageList";

// ===== [ANCHOR:COMPONENT] =====

export function ChatPanel() {
  // ===== [ANCHOR:STATE] =====
  const messages = useChatStore(selectMessages);
  const currentStreamingMessage = useChatStore(selectCurrentStreamingMessage);
  const inputText = useChatStore(selectInputText);
  const isStreaming = useChatStore(selectIsStreaming);
  const showThinking = useChatStore(selectShowThinking);
  const searchQuery = useChatStore(selectSearchQuery);
  const searchFilters = useChatStore(selectSearchFilters);

  // ===== [ANCHOR:HOOKS] =====
  const chatPanel = useChatPanel();
  const chatController = useChatController();

  // ===== [ANCHOR:COMPUTED] =====
  const filteredMessages = filterMessages(messages, {
    query: searchQuery,
    filters: searchFilters,
  });

  // ===== [ANCHOR:RENDER] =====
  return (
    <div className={styles.panel}>
      <div
        ref={chatPanel.messagesRef}
        className={styles.messages}
        onScroll={chatPanel.handleScroll}
      >
        <MessageList
          messages={filteredMessages}
          currentStreamingMessage={currentStreamingMessage}
          showThinking={showThinking}
          onToggleMessageCollapse={chatController.toggleMessageCollapse}
          onToggleThinkingCollapse={chatController.toggleThinkingCollapse}
          onToggleToolsCollapse={chatController.toggleToolsCollapse}
          onDeleteMessage={chatController.deleteMessage}
          onRegenerateMessage={chatController.regenerateMessage}
        />
      </div>

      <div className={styles.input}>
        <InputArea
          value={inputText}
          isStreaming={isStreaming}
          onChange={chatController.setInputText}
          onSend={chatPanel.handleSend}
          onSendWithImages={chatPanel.handleSendWithImages}
          onAbort={chatController.abortGeneration}
          onBashCommand={chatPanel.handleBashCommand}
          onSlashCommand={chatPanel.handleSlashCommand}
          onNewSession={chatPanel.handleNewSession}
          // 自动滚屏相关
          shouldScrollToBottom={chatPanel.shouldScrollToBottom}
          onToggleScroll={() => chatPanel.setShouldScrollToBottom(!chatPanel.shouldScrollToBottom)}
        />
      </div>
    </div>
  );
}
