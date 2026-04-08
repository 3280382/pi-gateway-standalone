/**
 * Footer - 全局底部导航
 * 职责：纯布局容器，根据当前视图操作对应 feature 的 sidebar/panel
 */

import styles from "@/app/Footer.module.css";
import { ToolMenu } from "@/app/Tools";
import { IconButton, IconToggle } from "@/components/Icon/Icon";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { useFileStore } from "@/features/files/stores";
import { useAppStore } from "@/stores/appStore";

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
	const isSidebarVisible =
		currentView === "chat" ? chatSidebarVisible : filesSidebarVisible;
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
