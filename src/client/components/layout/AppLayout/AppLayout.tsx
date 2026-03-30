/**
 * AppLayout - 统一布局控制器
 */

import { useChatController } from "@/services/api/chatApi";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { InputArea } from "../../chat/InputArea/InputArea";
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
			{/* 1. 顶部菜单 - 固定高度64px */}
			<header className={styles.header}>
				<TopBar
					workingDir={currentDir}
					connectionStatus={isConnected ? "connected" : "disconnected"}
					pid={serverPid}
				/>
			</header>

			{/* 2. 主体区域 - 内容区 + 输入框 */}
			<div className={styles.body}>
				<main className={styles.content}>
					<div className={styles.contentBody}>{children}</div>
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
				</main>
			</div>

			{/* 3. 底部菜单 - 始终可见 */}
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

			{/* 4. 侧边栏 - 覆盖顶部和中间，不覆盖底部 */}
			{isSidebarVisible && (
				<aside className={styles.sidebarOverlay}>
					<SidebarPanel
						isVisible={isSidebarVisible}
						onSwitchView={setCurrentView}
						currentView={currentView}
					/>
				</aside>
			)}

			{/* 5. 底部弹出面板 */}
			{isBottomPanelOpen && (
				<div
					className={styles.bottomPanel}
					style={{ height: bottomPanelHeight }}
				>
					<div className={styles.resizer}>
						<div
							className={styles.dragHandle}
							onMouseDown={(e) => {
								const startY = e.clientY;
								const startHeight = bottomPanelHeight;

								const handleMouseMove = (e: MouseEvent) => {
									const delta = startY - e.clientY;
									setBottomPanelHeight(
										Math.max(100, Math.min(500, startHeight + delta)),
									);
								};

								const handleMouseUp = () => {
									document.removeEventListener("mousemove", handleMouseMove);
									document.removeEventListener("mouseup", handleMouseUp);
								};

								document.addEventListener("mousemove", handleMouseMove);
								document.addEventListener("mouseup", handleMouseUp);
							}}
						/>
						<button
							className={styles.closeBtn}
							onClick={() => toggleBottomPanel(null)}
						>
							×
						</button>
					</div>
					<div className={styles.panelContent}>
						{bottomPanelContent || (
							<div className={styles.emptyPanel}>Terminal Panel</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
