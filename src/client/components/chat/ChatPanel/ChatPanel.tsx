/**
 * ChatPanel - Main Chat Container with TopBar
 */

import { useEffect, useCallback } from 'react';
import { TopBar } from '../../layout/TopBar/TopBar';
import { MessageList } from '../MessageList/MessageList';
import { InputArea } from '../InputArea/InputArea';
import { useSessionStore } from '@/stores/sessionStore';
import { useChatStore, selectMessages, selectCurrentStreamingMessage, selectInputText, selectIsStreaming, selectShowThinking } from '@/stores/chatStore';
import { useChatController } from '@/services/api/chatApi';
import styles from './ChatPanel.module.css';

export function ChatPanel() {
  const messages = useChatStore(selectMessages);
  const currentStreamingMessage = useChatStore(selectCurrentStreamingMessage);
  const inputText = useChatStore(selectInputText);
  const isStreaming = useChatStore(selectIsStreaming);
  const showThinking = useChatStore(selectShowThinking);
  
  const { currentDir, isConnected, serverPid } = useSessionStore();
  const controller = useChatController();

  const handleSend = useCallback(() => {
    if (inputText.trim()) {
      controller.sendMessage(inputText);
    }
  }, [inputText, controller]);

  const handleBashCommand = useCallback((command: string) => {
    // Send as a bash tool call through the chat
    const bashMessage = `/bash ${command}`;
    controller.setInputText(bashMessage);
    // Small delay to allow state update
    setTimeout(() => {
      controller.sendMessage(bashMessage);
    }, 0);
  }, [controller]);

  const handleSlashCommand = useCallback((command: string, args: string) => {
    switch (command) {
      case 'clear':
        controller.clearMessages();
        break;
      case 'new':
        // Create new session
        controller.clearMessages();
        break;
      case 'save':
        // Save session - would need implementation
        console.log('Save session:', args);
        break;
      case 'load':
        // Load session - would need implementation
        console.log('Load session:', args);
        break;
      case 'bash':
        if (args) {
          controller.sendMessage(`/bash ${args}`);
        }
        break;
      case 'read':
        if (args) {
          controller.sendMessage(`/read ${args}`);
        }
        break;
      case 'write':
        // Parse write command: /write path content
        const writeParts = args.split(' ');
        const writePath = writeParts[0];
        const writeContent = writeParts.slice(1).join(' ');
        if (writePath && writeContent) {
          controller.sendMessage(`/write ${writePath} ${writeContent}`);
        }
        break;
      case 'edit':
        if (args) {
          controller.sendMessage(`/edit ${args}`);
        }
        break;
      case 'ls':
        controller.sendMessage(`/ls ${args || '.'}`);
        break;
      case 'grep':
        if (args) {
          controller.sendMessage(`/grep ${args}`);
        }
        break;
      case 'tree':
        controller.sendMessage(`/tree ${args || '.'}`);
        break;
      case 'git':
        if (args) {
          controller.sendMessage(`/git ${args}`);
        }
        break;
      default:
        // Unknown command, send as regular message
        controller.sendMessage(`/${command} ${args}`.trim());
    }
  }, [controller]);

  // Handle regenerate event from store
  useEffect(() => {
    const handleResend = (e: CustomEvent) => {
      const { text } = e.detail;
      if (text) {
        controller.sendMessage(text);
      }
    };

    window.addEventListener('chat:resend', handleResend as EventListener);
    return () => {
      window.removeEventListener('chat:resend', handleResend as EventListener);
    };
  }, [controller]);

  const connectionStatus = isConnected ? 'connected' : 'disconnected';

  return (
    <div className={styles.panel}>
      <TopBar 
        workingDir={currentDir}
        connectionStatus={connectionStatus}
        pid={serverPid}
      />

      <MessageList
        messages={messages}
        currentStreamingMessage={currentStreamingMessage}
        showThinking={showThinking}
        onToggleMessageCollapse={controller.toggleMessageCollapse}
        onToggleThinkingCollapse={controller.toggleThinkingCollapse}
        onDeleteMessage={controller.deleteMessage}
        onRegenerateMessage={controller.regenerateMessage}
      />

      <InputArea
        value={inputText}
        isStreaming={isStreaming}
        onChange={controller.setInputText}
        onSend={handleSend}
        onAbort={controller.abortGeneration}
        onBashCommand={handleBashCommand}
        onSlashCommand={handleSlashCommand}
      />
    </div>
  );
}
