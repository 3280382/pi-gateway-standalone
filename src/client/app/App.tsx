/**
 * App - Gateway Main Application
 */

import React, { Suspense } from "react";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { useAppStore } from "@/stores/appStore";
import { Footer } from "@/app/Footer";
import { LoadingScreen } from "@/app/LoadingScreen";
import "@/styles/global.css";
import styles from "@/app/App.module.css";

// 懒加载页面
const ChatPage = React.lazy(() => import("@/features/chat/page"));
const FilesPage = React.lazy(() => import("@/features/files/page"));

function AppContent() {
	const { currentView } = useAppStore();

	return (
		<div className={styles.app}>
			<main className={styles.pageContainer}>
				{/* Chat - 通过 props 传递 active 状态 */}
				<Suspense fallback={<LoadingScreen />}>  
					<ChatPage active={currentView === "chat"} />
				</Suspense>

				{/* Files - 通过 props 传递 active 状态 */}
				<Suspense fallback={<LoadingScreen />}>
					<FilesPage active={currentView === "files"} />
				</Suspense>
			</main>

			<Footer />
		</div>
	);
}

export default function App() {
	return (
		<ErrorBoundary>
			<AppContent />
		</ErrorBoundary>
	);
}
