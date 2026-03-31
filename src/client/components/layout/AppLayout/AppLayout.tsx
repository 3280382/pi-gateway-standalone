/**
 * AppLayout - 统一布局控制器 (Flex + 文档流)
 */

import { useChatController } from "@/services/api/chatApi";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { InputArea } from "../../chat/InputArea/InputArea";
import { FileSidebar } from "../../files/FileSidebar";
import { BottomMenu } from "../BottomMenu";
import { SidebarPanel } from "../SidebarPanel/SidebarPanel";
import { TopBar } from "../TopBar/TopBar";
import styles from "./AppLayout.module.css";
import { useLayout } from "./LayoutContext";

interface AppLayoutProps {
	children: React.ReactNode;
	showInput?: boolean;
	bottomPanelContent?: React.ReactNode;
}

export function AppLayout({
	children,
	showInput = true,
	bottomPanelContent,
}: AppLayoutProps) {
	const {
		isSidebarVisible,
		toggleSidebar,
		currentView,
		setCurrentView,
		isBottomPanelOpen,
		bottomPanelHeight,
		setBottomPanelHeight,
		toggleBottomPanel,
	} = useLayout();

	const { currentDir, isConnected, serverPid } = useSessionStore();
	const controller = useChatController();
	const inputText = useChatStore((s) => s.inputText);
	const isStreaming = useChatStore((s) => s.isStreaming);

	return (
		<div className={styles.layout}>
			{/* 侧边栏 - 绝对定位，遮挡顶部和内容，不遮挡底部 */}
			<aside
				className={`${styles.sidebar} ${isSidebarVisible ? styles.sidebarVisible : styles.sidebarHidden}`}
			>
				{currentView === "chat" ? (
					<SidebarPanel
						isVisible={isSidebarVisible}
						onSwitchView={setCurrentView}
						currentView={currentView}
					/>
				) : (
					<FileSidebar visible={isSidebarVisible} />
				)}
			</aside>

			{/* 1. Header - 顶部菜单 (固定68px) */}
			<header className={styles.header}>
				<TopBar
					workingDir={currentDir}
					connectionStatus={isConnected ? "connected" : "disconnected"}
					pid={serverPid}
					currentView={currentView}
				/>
			</header>

			{/* 2. Main - 主区域 (flex: 1) */}
			<div className={styles.main}>
				{/* 内容区 */}
				<div className={styles.content}>
					{/* 可滚动内容 */}
					<div className={styles.contentBody}>{children}</div>

					{/* 底部面板 - 直接渲染传入的内容 */}
					{isBottomPanelOpen && bottomPanelContent}

					{/* 输入框 */}
					{showInput && (
						<div className={styles.inputArea}>
							<InputArea
								value={inputText}
								isStreaming={isStreaming}
								onChange={controller.setInputText}
								onSend={() =>
									inputText.trim() && controller.sendMessage(inputText)
								}
								onAbort={controller.abortGeneration}
								onBashCommand={(cmd) => controller.sendMessage(`/bash ${cmd}`)}
								onSlashCommand={(cmd, args) => {
									if (cmd === "clear") controller.clearMessages();
									else controller.sendMessage(`/${cmd} ${args}`.trim());
								}}
							/>
						</div>
					)}
				</div>
			</div>

			{/* 3. Footer - 底部菜单 (固定44px) */}
			<footer className={styles.footer}>
				<BottomMenu
					isSidebarVisible={isSidebarVisible}
					currentView={currentView}
					isBottomPanelOpen={isBottomPanelOpen}
					onToggleSidebar={toggleSidebar}
					onSwitchView={setCurrentView}
					onToggleBottomPanel={() => toggleBottomPanel("terminal")}
				/>
			</footer>
		</div>
	);
}
