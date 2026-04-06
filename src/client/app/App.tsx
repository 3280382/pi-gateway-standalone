/**
 * App - Gateway Main Application (Refactored)
 *
 * 架构：
 * - Footer: 唯一全局控件（底部视图切换）
 * - PageContainer: 每个 feature 自己控制 Sidebar/Header/Content/Panel
 */

import { LayoutProvider, useLayout } from "@/app/LayoutContext";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { ErrorScreen } from "@/app/pages/ErrorScreen";
import { LoadingScreen } from "@/app/pages/LoadingScreen";
import { ChatPage } from "@/features/chat/page";
import { FilesPage } from "@/features/files/page";
import { useAppInitialization } from "@/features/chat/hooks/useAppInitialization";
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
			{/* PageContainer: 每个 feature 自己控制 Sidebar/Header/Content/Panel */}
			<main className={styles.pageContainer}>
				{currentView === "chat" ? <ChatPage /> : <FilesPage />}
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
		<ErrorBoundary>
			<LayoutProvider>
				<AppContent />
			</LayoutProvider>
		</ErrorBoundary>
	);
}
