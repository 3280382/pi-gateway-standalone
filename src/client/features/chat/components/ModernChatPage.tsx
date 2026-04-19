/**
 * ModernChatPage - Complete modern chat interface
 */

import React, { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ModernHeader } from "@/components/layout/ModernHeader";
import { ModernChat, ChatMessage } from "@/components/chat/ModernChat";
import { useMobile } from "@/features/chat/hooks/useMobile";
import styles from "./ModernChatPage.module.css";

// Mock data for demonstration
const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Hello! Can you help me with a coding task?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "2",
    role: "assistant",
    content: "Hi there! I'd be happy to help you with your coding task. What would you like to work on?",
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
  },
  {
    id: "3",
    role: "user",
    content: "I need to create a React component with TypeScript.",
    timestamp: new Date(Date.now() - 1000 * 60 * 3),
  },
];

export const ModernChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const { closeSidebar } = useMobile();

  // Handle sending messages
  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Simulate AI response
    setIsStreaming(true);
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `You said: "${inputValue}"\n\nThis is a demo response. In the real implementation, this would be handled by the Pi SDK.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsStreaming(false);
    }, 1500);
  }, [inputValue]);

  // Handle abort
  const handleAbort = useCallback(() => {
    setIsStreaming(false);
  }, []);

  // Sidebar content
  const sidebarContent = (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2>Sessions</h2>
        <button className={styles.newButton}>+ New</button>
      </div>
      <div className={styles.sessionList}>
        <div className={`${styles.sessionItem} ${styles.active}`}>
          <span className={styles.sessionName}>Current Session</span>
          <span className={styles.sessionTime}>Just now</span>
        </div>
        <div className={styles.sessionItem}>
          <span className={styles.sessionName}>Previous Chat</span>
          <span className={styles.sessionTime}>2 hours ago</span>
        </div>
        <div className={styles.sessionItem}>
          <span className={styles.sessionName}>Code Review</span>
          <span className={styles.sessionTime}>Yesterday</span>
        </div>
      </div>
      
      <div className={styles.sidebarSection}>
        <h3>Settings</h3>
        <div className={styles.settingItem}>
          <span>Model</span>
          <span className={styles.settingValue}>claude-3-opus</span>
        </div>
        <div className={styles.settingItem}>
          <span>Temperature</span>
          <span className={styles.settingValue}>0.7</span>
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout
      header={
        <ModernHeader
          sessionId="abc123"
          modelName="claude-3-opus"
          onMenuClick={closeSidebar}
          onNewSession={() => setMessages([])}
        />
      }
      sidebar={sidebarContent}
    >
      <div className={styles.chatContainer} onClick={closeSidebar}>
        <ModernChat
          messages={messages}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          onAbort={handleAbort}
          isStreaming={isStreaming}
          currentModel="claude-3-opus"
        />
      </div>
    </AppLayout>
  );
};

export default ModernChatPage;
