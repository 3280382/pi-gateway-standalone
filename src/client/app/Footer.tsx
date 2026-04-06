/**
 * Footer - 全局底部导航
 * 职责：纯布局容器，根据当前视图操作对应 feature 的 sidebar/panel
 */

import { useAppStore } from "@/stores/appStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useFileStore } from "@/features/files/stores";
import type { BottomPanelType } from "@/features/files/types";
import { ToolMenu } from "@/app/Tools";
import styles from "@/app/Footer.module.css";

export function Footer() {
  const { currentView, setCurrentView } = useAppStore();

  // Chat sidebar 状态
  const chatSidebarVisible = useSidebarStore((state) => state.isVisible);
  const toggleChatSidebar = useSidebarStore((state) => state.toggleVisibility);
  const chatPanelOpen = useSidebarStore((state) => state.isBottomPanelOpen);
  const toggleChatPanel = useSidebarStore((state) => state.setBottomPanelOpen);

  // Files layout 状态
  const filesSidebarVisible = useFileStore((state) => state.isSidebarVisible);
  const toggleFilesSidebar = useFileStore((state) => state.toggleSidebar);
  const filesPanelOpen = useFileStore((state) => state.isBottomPanelOpen);
  const toggleFilesPanel = useFileStore((state) => state.toggleBottomPanel);

  // 根据当前视图决定使用哪个状态
  const isSidebarVisible = currentView === "chat" ? chatSidebarVisible : filesSidebarVisible;
  const toggleSidebar = () => {
    if (currentView === "chat") {
      toggleChatSidebar();
    } else {
      toggleFilesSidebar();
    }
  };
  
  // Panel 状态也根据视图切换
  const isPanelOpen = currentView === "chat" ? chatPanelOpen : filesPanelOpen;
  const togglePanel = () => {
    if (currentView === "chat") {
      toggleChatPanel(!chatPanelOpen);
    } else {
      toggleFilesPanel("terminal");
    }
  };

  return (
    <nav className={styles.footer}>
      <LeftGroup
        currentView={currentView}
        isSidebarVisible={isSidebarVisible}
        onToggleSidebar={toggleSidebar}
        isBottomPanelOpen={isPanelOpen}
        onTogglePanel={togglePanel}
      />

      <CenterGroup
        currentView={currentView}
        onSwitchView={setCurrentView}
      />

      <div className={styles.rightGroup}>
        <ToolMenu />
      </div>
    </nav>
  );
}

/**
 * 左侧组：侧边栏和面板切换
 */
interface LeftGroupProps {
  currentView: "chat" | "files";
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
  isBottomPanelOpen: boolean;
  onTogglePanel: () => void;
}

function LeftGroup({
  currentView,
  isSidebarVisible,
  onToggleSidebar,
  isBottomPanelOpen,
  onTogglePanel,
}: LeftGroupProps) {
  return (
    <div className={styles.leftGroup}>
      <button
        className={`${styles.button} ${isSidebarVisible ? styles.active : ""}`}
        onClick={onToggleSidebar}
        title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
      >
        {isSidebarVisible ? <LeftArrowIcon /> : <RightArrowIcon />}
      </button>

      {/* Chat/Files 都显示 Panel 按钮 */}
      <button
        className={`${styles.button} ${isBottomPanelOpen ? styles.active : ""}`}
        onClick={onTogglePanel}
        title={isBottomPanelOpen ? "Hide Panel" : "Show Panel"}
      >
        {isBottomPanelOpen ? <DownArrowIcon /> : <UpArrowIcon />}
      </button>
    </div>
  );
}

/**
 * 中间组：视图切换
 */
interface CenterGroupProps {
  currentView: "chat" | "files";
  onSwitchView: (view: "chat" | "files") => void;
}

function CenterGroup({ currentView, onSwitchView }: CenterGroupProps) {
  return (
    <div className={styles.centerGroup}>
      <button
        className={`${styles.button} ${currentView === "chat" ? styles.active : ""}`}
        onClick={() => onSwitchView("chat")}
        title="Chat"
      >
        <ChatIcon />
        <span>Chat</span>
      </button>

      <button
        className={`${styles.button} ${currentView === "files" ? styles.active : ""}`}
        onClick={() => onSwitchView("files")}
        title="Files"
      >
        <FilesIcon />
        <span>Files</span>
      </button>
    </div>
  );
}

// Icons
const iconStyle: React.CSSProperties = { width: 18, height: 18 };

function LeftArrowIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function RightArrowIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

function UpArrowIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function DownArrowIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function FilesIcon() {
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
