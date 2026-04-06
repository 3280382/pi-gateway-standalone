/**
 * App - Gateway Main Application (Refactored)
 *
 * 架构：
 * - Footer: 唯一全局控件（底部视图切换）
 * - PageContainer: 每个 feature 自己控制 Sidebar/Header/Content/Panel
 * - 代码分割：Chat 和 Files 页面按需加载
 */

import React, { Suspense } from "react";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { ErrorScreen } from "./ErrorScreen";
import { LoadingScreen } from "./LoadingScreen";
import { useAppInitialization } from "@/features/chat/hooks/useAppInitialization";
import { useAppStore } from "@/stores/appStore";
import { Footer } from "./Footer";
import "@/styles/global.css";
import styles from "./App.module.css";

// 代码分割：按需加载页面组件
const ChatPage = React.lazy(() => import("@/features/chat/page"));
const FilesPage = React.lazy(() => import("@/features/files/page"));

/**
 * AppContent - 应用内容组件
 */
function AppContent() {
	const { currentView } = useAppStore();

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
				<Suspense fallback={<LoadingScreen />}>
					{currentView === "chat" ? <ChatPage /> : <FilesPage />}
				</Suspense>
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
			<AppContent />
		</ErrorBoundary>
	);
}
