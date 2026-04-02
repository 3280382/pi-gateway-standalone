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
} from "./components/layout/AppLayout/LayoutContext";
import { useAppInitialization, useTerminalCommands } from "./hooks/app";
import { ChatPage, ErrorScreen, FilesPage, LoadingScreen } from "./pages";
import "./styles/global.css";

/**
 * AppContent - 应用内容组件
 * 根据当前状态渲染不同页面
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

	// 聊天视图
	if (currentView === "chat") {
		return (
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
		);
	}

	// 文件浏览器视图
	return (
		<FilesPage
			terminalOutput={terminalOutput}
			terminalCommand={terminalCommand}
			onBashCommand={executeBashCommand}
			onOpenBottomPanel={setTerminalCommand}
			closeBottomPanel={closeBottomPanel}
			setBottomPanelHeight={setBottomPanelHeight}
		/>
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
