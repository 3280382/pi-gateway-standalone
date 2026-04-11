/**
 * SidebarPanel - Main Sidebar Container
 *
 * 职责：
 * - 负责侧边栏的整体布局
 * - 包含所有sidebar子组件（CompactWorkspaces, SessionDropdown, ModelParams, ChatSettings）
 * - 显示错误信息
 * - 不包含业务逻辑，session加载由sessionManager统一处理
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { useCallback } from "react";
import { IconButton } from "@/components/Icon/Icon";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { useLlmLogStore } from "@/features/chat/stores/llmLogStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useWorkspaceStore } from "@/features/files/stores";
import { CompactWorkspacesSection } from "./CompactWorkspacesSection";
import { SessionDropdownSection } from "./SessionDropdownSection";
import { ModelParamsSection } from "./ModelParamsSection";
import { ChatSettingsSection } from "./ChatSettingsSection";
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

  // ========== 5. Render ==========
  return (
    <aside className={`${styles.sidebar} ${!isVisible ? styles.sidebarHidden : ""}`}>
      <SidebarHeader />
      <div className={styles.content}>
        {error && (
          <div className={styles.error}>
            <span>{error}</span>
            <button type="button" onClick={clearError}>×</button>
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

