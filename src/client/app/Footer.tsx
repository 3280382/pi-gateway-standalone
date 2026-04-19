/**
 * Footer - Global bottom navigation
 * Responsibilities:纯布局容器，根据当前视图操作对应 feature 的 sidebar/panel
 */

// ===== [ANCHOR:IMPORTS] =====

import styles from "@/app/Footer.module.css";
import { ToolMenu } from "@/app/Tools/ToolMenu";
import { IconButton, IconToggle } from "@/components/Icon/Icon";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useFileStore } from "@/features/files/stores";
import { useAppStore } from "@/stores/appStore";

// ===== [ANCHOR:COMPONENT] =====

export function Footer() {
  // ===== [ANCHOR:STATE] =====
  const { currentView, setCurrentView } = useAppStore();

  // Chat sidebar state
  const chatSidebarVisible = useSidebarStore((state) => state.isVisible);
  const toggleChatSidebar = useSidebarStore((state) => state.toggleVisibility);
  const chatPanelOpen = useSidebarStore((state) => state.isBottomPanelOpen);
  const toggleChatPanel = useSidebarStore((state) => state.setBottomPanelOpen);

  // Files layout state
  const filesSidebarVisible = useFileStore((state) => state.isSidebarVisible);
  const toggleFilesSidebar = useFileStore((state) => state.toggleSidebar);
  const filesPanelOpen = useFileStore((state) => state.isBottomPanelOpen);
  const toggleFilesPanel = useFileStore((state) => state.toggleBottomPanel);

  // ===== [ANCHOR:COMPUTED] =====
  const isSidebarVisible = currentView === "chat" ? chatSidebarVisible : filesSidebarVisible;
  const toggleSidebar = () => {
    if (currentView === "chat") {
      toggleChatSidebar();
    } else {
      toggleFilesSidebar();
    }
  };

  const isPanelOpen = currentView === "chat" ? chatPanelOpen : filesPanelOpen;
  const togglePanel = () => {
    if (currentView === "chat") {
      toggleChatPanel(!chatPanelOpen);
    } else {
      toggleFilesPanel("terminal");
    }
  };

  // ===== [ANCHOR:RENDER] =====
  return (
    <nav className={styles.footer}>
      {/* 左侧：侧边栏和面板切换 */}
      <div className={styles.leftGroup}>
        <IconToggle
          activeIcon="leftArrow"
          inactiveIcon="rightArrow"
          isActive={isSidebarVisible}
          onClick={toggleSidebar}
          title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
          variant="toggle"
        />
        <IconToggle
          activeIcon="downArrow"
          inactiveIcon="upArrow"
          isActive={isPanelOpen}
          onClick={togglePanel}
          title={isPanelOpen ? "Hide Panel" : "Show Panel"}
          variant="toggle"
        />
      </div>

      {/* 中间：视图切换 */}
      <div className={styles.centerGroup}>
        <IconButton
          name="chat"
          label="Chat"
          variant={currentView === "chat" ? "primary" : "default"}
          onClick={() => setCurrentView("chat")}
          title="Chat"
        />
        <IconButton
          name="files"
          label="Files"
          variant={currentView === "files" ? "primary" : "default"}
          onClick={() => setCurrentView("files")}
          title="Files"
        />
      </div>

      {/* 右侧：工具菜单 */}
      <div className={styles.rightGroup}>
        <ToolMenu />
      </div>
    </nav>
  );
}
