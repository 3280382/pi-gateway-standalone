/**
 * App - Gateway Main Application (Refactored)
 *
 * 新架构：
 * - Footer: 唯一全局控件（底部视图切换）
 * - PageContainer: 由当前 feature 完全接管（包含自己的 Header/Sidebar/Panel/Modals）
 * - Chat/Files: 各自独立的完整功能模块
 */

import { LayoutProvider, useLayout } from "@/features/core/layout/AppLayout/LayoutContext";
import { ErrorScreen } from "@/features/core/pages/ErrorScreen";
import { LoadingScreen } from "@/features/core/pages/LoadingScreen";
import { ChatPage } from "@/features/chat/page";
import { FilesPage } from "@/features/files/page";
import { useAppInitialization, useTerminalCommands } from "@/hooks/app";
import { Footer } from "./Footer";
import "@/styles/global.css";
import styles from "./App.module.css";

/**
 * AppContent - 应用内容组件
 */
function AppContent() {
	const { currentView } = useLayout();

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
			{/* PageContainer: 每个 feature 自己控制 Header/Sidebar/Panel/Modals */}
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
