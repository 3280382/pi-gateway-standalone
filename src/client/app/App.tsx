/**
 * App - Gateway Main Application
 */

import React, { Suspense, useRef } from "react";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { useAppStore } from "@/stores/appStore";
import { Footer } from "@/app/Footer";
import { LoadingScreen } from "@/app/LoadingScreen";
import "@/styles/global.css";
import styles from "@/app/App.module.css";

// 懒加载页面
const ChatPage = React.lazy(() => import("@/features/chat/page"));
const FilesPage = React.lazy(() => import("@/features/files/page"));

/**
 * KeepAlive - 页面缓存容器
 * 功能：
 * - 首次激活才挂载
 * - 挂载后永不卸载
 * - 通过 display 控制显示隐藏
 */
function KeepAlive({
	active,
	children,
}: {
	active: boolean;
	children: React.ReactNode;
}) {
	const mountedRef = useRef(false);

	// 首次激活时标记
	if (active) {
		mountedRef.current = true;
	}

	// 未激活过，不渲染（避免提前加载）
	if (!mountedRef.current) return null;

	return (
		<div
			style={{
				display: active ? "block" : "none",
				width: "100%",
				height: "100%",
			}}
		>
			{children}
		</div>
	);
}

function AppContent() {
	const { currentView } = useAppStore();

	return (
		<div className={styles.app}>
			<main className={styles.pageContainer}>
				{/* Chat */}
				<KeepAlive active={currentView === "chat"}>
					<Suspense fallback={<LoadingScreen />}>
						<ChatPage />
					</Suspense>
				</KeepAlive>

				{/* Files */}
				<KeepAlive active={currentView === "files"}>
					<Suspense fallback={<LoadingScreen />}>
						<FilesPage />
					</Suspense>
				</KeepAlive>
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