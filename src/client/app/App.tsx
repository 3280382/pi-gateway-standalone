/**
 * App - Gateway Main Application (Refactored)
 *
 * 新架构：
 * - Footer: 唯一全局控件（底部视图切换）
 * - Sidebar: 全局 overlay（左侧滑出）
 * - PageContainer: 由当前 feature 完全接管（包含自己的 Header/Content/Panel）
 * - Chat/Files: 各自独立的完整功能模块
 */

import { LayoutProvider, useLayout } from "@/features/core/layout/AppLayout/LayoutContext";
import { SidebarPanel } from "@/features/sidebar/components/SidebarPanel/SidebarPanel";
import { ErrorScreen } from "@/features/core/pages/ErrorScreen";
import { LoadingScreen } from "@/features/core/pages/LoadingScreen";
import { ChatPage } from "@/features/chat/page";
import { FilesPage } from "@/features/files/page";
import { useAppInitialization, useTerminalCommands } from "@/hooks/app";
import { Footer } from "./Footer";
import "@/styles/global.css";
import styles from "./App.module.css";
import sidebarStyles from "@/features/core/layout/AppLayout/AppLayout.module.css";

/**
 * AppContent - 应用内容组件
 */
function AppContent() {
	const { currentView, isSidebarVisible } = useLayout();

	// 应用初始化状态
	const { isLoading, error, retry } = useAppInitialization();

	// 终端命令管理
	const {
		terminalOutput,
		terminalCommand,
		commandResults,
		isExecuting,
		setTerminalCommand,
		executeBashCommand,
		executeSlashCommand,
	} = useTerminalCommands();

	// 错误状态
	if (error) {
		return <ErrorScreen error={error} onRetry={retry} />;
	}

	// 加载状态
	if (isLoading) {
		return <LoadingScreen />;
	}

	return (
		<div className={styles.app}>
			{/* 全局 Sidebar Overlay */}
			<aside
				className={`${sidebarStyles.sidebar} ${isSidebarVisible ? sidebarStyles.sidebarVisible : sidebarStyles.sidebarHidden}`}
			>
				<SidebarPanel isVisible={isSidebarVisible} currentView={currentView} />
			</aside>

			{/* PageContainer: 每个 feature 控制 Header/Content/Panel */}
			<main className={styles.pageContainer}>
				{currentView === "chat" ? (
					<ChatPage
						terminalOutput={terminalOutput}
						terminalCommand={terminalCommand}
						commandResults={commandResults}
						isExecuting={isExecuting}
						onBashCommand={executeBashCommand}
						onSlashCommand={executeSlashCommand}
						closeBottomPanel={() => {}}
						setBottomPanelHeight={() => {}}
					/>
				) : (
					<FilesPage
						terminalOutput={terminalOutput}
						terminalCommand={terminalCommand}
						onBashCommand={executeBashCommand}
						onOpenBottomPanel={setTerminalCommand}
						closeBottomPanel={() => {}}
						setBottomPanelHeight={() => {}}
					/>
				)}
			</main>

			{/* Footer: 唯一全局控件 */}
			<Footer />
		</div>
	);
}

/**
 * App - 应用根组件
 */
export default function App() {
	return (
		<LayoutProvider>
			<AppContent />
		</LayoutProvider>
	);
}
