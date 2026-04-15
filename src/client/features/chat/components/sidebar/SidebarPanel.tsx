/**
 * SidebarPanel - Main Sidebar Container
 *
 * Responsibilities:
 * - Overall sidebar layout
 * - Contains all sidebar sub-components (CompactWorkspaces, SessionDropdown, ModelParams, ChatSettings)
 * - Displays error messages
 * - No business logic, session loading handled by sessionManager
 *
 * Structure: State → Ref → Effects → Computed → Actions → Render
 */

import { useCallback } from "react";
import { IconButton } from "@/components/Icon/Icon";
import { useSidebarSessions } from "@/features/chat/hooks/useSidebarSessions";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { useLlmLogStore } from "@/features/chat/stores/llmLogStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { ChatSettingsSection } from "./ChatSettingsSection";
import { CompactWorkspacesSection } from "./CompactWorkspacesSection";
import { ModelParamsSection } from "./ModelParamsSection";
import { SessionDropdownSection } from "./SessionDropdownSection";
import styles from "./SidebarPanel.module.css";

// ============================================================================
// Types
// ============================================================================

interface SidebarPanelProps {
  onSwitchView?: (view: "chat" | "files") => void;
  currentView?: "chat" | "files";
}

// ============================================================================
// Main Component
// ============================================================================

export function SidebarPanel({ currentView = "chat" }: SidebarPanelProps) {
  // ========== 1. State (Domain State from Zustand) ==========
  const isVisible = useSidebarStore((state) => state.isVisible);
  const error = useSidebarStore((state) => state.error);
  const clearError = useSidebarStore((state) => state.clearError);

  // 以当前工作目录为参数，从服务器获取所有历史 session 文件
  const { isLoading: isSessionsLoading } = useSidebarSessions();

  // ========== 5. Render ==========
  return (
    <aside className={`${styles.sidebar} ${!isVisible ? styles.sidebarHidden : ""}`}>
      <SidebarHeader />
      <div className={styles.content}>
        {error && (
          <div className={styles.error}>
            <span>{error}</span>
            <button type="button" onClick={clearError}>
              ×
            </button>
          </div>
        )}
        <CompactWorkspacesSection maxItems={3} />
        {currentView === "chat" && <SessionDropdownSection />}
        {currentView === "chat" && <ModelParamsSection />}
        {currentView === "chat" && <ChatSettingsSection />}
      </div>
    </aside>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Sidebar Header
 */
function SidebarHeader() {
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);

  return (
    <div className={styles.header}>
      <div className={styles.logo}>π</div>
      <h2 className={styles.title}>Pi Gateway</h2>
      <IconButton name="chevron-left" onClick={toggleSidebar} title="Toggle Sidebar" />
    </div>
  );
}
