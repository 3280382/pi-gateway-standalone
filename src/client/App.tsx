/**
 * App - Gateway Main Application
 *
 * 重构后的架构：
 * - 页面组件: LoadingScreen, ErrorScreen, ChatPage, FilesPage
 * - 业务 Hooks: useAppInitialization, useTerminalCommands, useChatMessages
 * - 布局: AppLayout (共享统一布局)
 */

import {
	LayoutProvider,
	useLayout,
} from "./features/core/layout/AppLayout/LayoutContext";
import { useAppInitialization, useTerminalCommands } from "./hooks/app";
import { ChatPage, ErrorScreen, FilesPage, LoadingScreen } from "./features/core/pages";
import "./styles/global.css";

/**
 * AppContent - 应用内容组件
 * 使用 CSS 控制视图显隐，避免组件卸载/挂载开销
 */
function AppContent() {
	// 布局上下文
	const {
		currentView,
		isBottomPanelOpen,
		bottomPanelHeight,
		setBottomPanelHeight,
		closeBottomPanel,
	} = useLayout();

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

	// 同时渲染两个视图，通过 CSS 控制显隐
	// 避免切换时组件卸载/挂载导致的重新加载
	return (
		<>
			<div style={{ display: currentView === "chat" ? "contents" : "none" }}>
				<ChatPage
					terminalOutput={terminalOutput}
					terminalCommand={terminalCommand}
					commandResults={commandResults}
					isExecuting={isExecuting}
					onBashCommand={executeBashCommand}
					onSlashCommand={executeSlashCommand}
					closeBottomPanel={closeBottomPanel}
					setBottomPanelHeight={setBottomPanelHeight}
				/>
			</div>
			<div style={{ display: currentView === "files" ? "contents" : "none" }}>
				<FilesPage
					terminalOutput={terminalOutput}
					terminalCommand={terminalCommand}
					onBashCommand={executeBashCommand}
					onOpenBottomPanel={setTerminalCommand}
					closeBottomPanel={closeBottomPanel}
					setBottomPanelHeight={setBottomPanelHeight}
				/>
			</div>
		</>
	);
}

/**
 * App - 应用根组件
 * 提供 LayoutProvider 上下文
 */
function App() {
	return (
		<LayoutProvider>
			<AppContent />
		</LayoutProvider>
	);
}

export default App;
