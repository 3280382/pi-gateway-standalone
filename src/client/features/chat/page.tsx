/**
 * ChatPage - 聊天Pages面
 *
 * 实现 KeepAlive：首次激活才挂载，之后通过 display 控制显示Hidden
 * 合并了原 ChatLayout 的布局逻辑
 */

import { useCallback } from "react";
import styles from "@/features/chat/ChatLayout.module.css";
import { ChatPanel } from "@/features/chat/components/ChatPanel";
import { AppHeader } from "@/features/chat/components/Header";
import { SessionInfoModal } from "@/features/chat/components/modals/SessionInfoModal";
import { LlmLogPanel } from "@/features/chat/components/panels/LlmLogPanel";
import { SidebarPanel } from "@/features/chat/components/sidebar/SidebarPanel";
import { useChatInit } from "@/features/chat/hooks";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";

export function ChatPage() {
  // 总是在顶层调用 Hooks（React Hooks 规则）
  const { isConnecting } = useChatInit();

  // 从 sidebarStore 获取布局状态
  const isSidebarVisible = useSidebarStore((state) => state.isVisible);
  const isBottomPanelOpen = useSidebarStore((state) => state.isBottomPanelOpen ?? false);
  const bottomPanelHeight = useSidebarStore((state) => state.bottomPanelHeight ?? 300);
  const closeBottomPanel = useSidebarStore((state) => state.closeBottomPanel ?? (() => {}));
  const setBottomPanelHeight = useSidebarStore((state) => state.setBottomPanelHeight ?? (() => {}));

  // 渲染Bottom panel
  const renderBottomPanel = useCallback(() => {
    if (!isBottomPanelOpen) return null;

    return (
      <LlmLogPanel
        height={bottomPanelHeight}
        onClose={closeBottomPanel}
        onHeightChange={setBottomPanelHeight}
      />
    );
  }, [isBottomPanelOpen, bottomPanelHeight, closeBottomPanel, setBottomPanelHeight]);

  // 连接中状态
  if (isConnecting) {
    return (
      <div
        className={styles.loading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
          height: "100%",
          width: "100%",
        }}
      >
        <div
          className={styles.spinner}
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid var(--border-color)",
            borderTopColor: "var(--accent-primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "var(--text-muted)", textAlign: "center", width: "100%" }}>
          Connecting...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.layout}>
        {/* Header */}
        <header className={styles.header}>
          <AppHeader />
        </header>

        {/* Body */}
        <div className={styles.body}>
          {/* Sidebar - overlay 模式 */}
          <aside
            className={`${styles.sidebar} ${isSidebarVisible ? styles.sidebarVisible : styles.sidebarHidden}`}
          >
            <SidebarPanel currentView="chat" />
          </aside>

          {/* Content */}
          <main className={styles.content}>
            <ChatPanel />
            {renderBottomPanel()}
          </main>
        </div>
      </div>

      {/* Modals */}
      <SessionInfoModal />
    </>
  );
}

export default ChatPage;
