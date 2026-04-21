/**
 * ChatPanel - Main Chat Container
 *
 * Responsibilities:
 * - 负责Chat panel的整体布局
 * - 协调 MessageList 和 InputArea Group件
 * - 不包含业务逻辑，只负责视图Group合
 */

// ===== [ANCHOR:IMPORTS] =====

import { useChatPanel } from "@/features/chat/hooks/useChatPanel";
import { useChatController } from "@/features/chat/services/api/chatApi";
import {
  filterMessages,
  selectCurrentStreamingMessage,
  selectInputText,
  selectIsRunning,
  selectIsStreaming,
  selectMessages,
  selectSearchFilters,
  selectSearchQuery,
  selectShowThinking,
  useChatStore,
  selectStreamingContent,
  selectStreamingThinking,
  selectStreamingToolCalls,
  selectActiveTools,
} from "@/features/chat/stores/chatStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import styles from "./ChatPanel.module.css";
import { InputArea } from "./InputArea";
import { MessageList } from "./MessageList";
import { TemplateModal } from "./modals/TemplateModal";

// ===== [ANCHOR:COMPONENT] =====

export function ChatPanel() {
  // ===== [ANCHOR:STATE] =====
  const messages = useChatStore(selectMessages);
  const currentStreamingMessage = useChatStore(selectCurrentStreamingMessage);
  const inputText = useChatStore(selectInputText);
  const isStreaming = useChatStore(selectIsStreaming);
  const isRunning = useChatStore(selectIsRunning);
  const showThinking = useChatStore(selectShowThinking);
  const searchQuery = useChatStore(selectSearchQuery);
  const searchFilters = useChatStore(selectSearchFilters);

  // Streaming state - passed to MessageList as props to control re-render frequency
  const streamingContent = useChatStore(selectStreamingContent);
  const streamingThinking = useChatStore(selectStreamingThinking);
  const streamingToolCalls = useChatStore(selectStreamingToolCalls);
  const activeTools = useChatStore(selectActiveTools);

  // ===== [ANCHOR:HOOKS] =====
  const chatPanel = useChatPanel();
  const chatController = useChatController();
  const { openTemplateModal } = useModalStore();

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
          streamingContent={streamingContent}
          streamingThinking={streamingThinking}
          streamingToolCalls={streamingToolCalls}
          activeTools={activeTools}
        />
      </div>

      <div className={styles.input}>
        <InputArea
          value={inputText}
          isStreaming={isStreaming}
          isRunning={isRunning}
          onChange={chatController.setInputText}
          onSend={chatPanel.handleSend}
          onSendWithImages={chatPanel.handleSendWithImages}
          onAbort={chatController.abortGeneration}
          onSteer={chatController.steer}
          onBashCommand={chatPanel.handleBashCommand}
          onSlashCommand={chatPanel.handleSlashCommand}
          onNewSession={chatPanel.handleNewSession}
          onCompactSession={chatController.compactSession}
          onExportSession={chatController.exportSession}
          // Auto scroll related
          shouldScrollToBottom={chatPanel.shouldScrollToBottom}
          onToggleScroll={() => chatPanel.setShouldScrollToBottom(!chatPanel.shouldScrollToBottom)}
          // Reload messages
          onReloadMessages={chatPanel.reloadAllMessages}
          isLoadingMore={chatPanel.isLoadingMore}
          // Template insertion
          onInsertTemplate={openTemplateModal}
        />
      </div>

      <TemplateModal
        onTemplateSelect={(content) => {
          chatController.setInputText(useChatStore.getState().inputText + content);
        }}
      />
    </div>
  );
}
