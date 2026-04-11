/**
 * App - Gateway Main Application
 */

// ===== [ANCHOR:IMPORTS] =====

import React, { Suspense, useRef } from "react";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Footer } from "@/app/Footer";
import { LoadingScreen } from "@/app/LoadingScreen";
import { useAppStore } from "@/stores/appStore";
import "@/styles/global.css";
import styles from "@/app/App.module.css";

// 懒加载页面
const ChatPage = React.lazy(() => import("@/features/chat/page"));
const FilesPage = React.lazy(() => import("@/features/files/page"));

// ===== [ANCHOR:KEEP_ALIVE_COMPONENT] =====

/**
 * KeepAlive - 页面缓存容器
 * 功能：
 * - 首次激活才挂载
 * - 挂载后永不卸载
 * - 通过 display 控制显示隐藏
 * - 避免未激活页面提前加载资源
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
				display: active ? "flex" : "none",
				height: "100%",
				width: "100%",
			}}
		>
			{children}
		</div>
	);
}

// ===== [ANCHOR:APP_CONTENT_COMPONENT] =====

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

// ===== [ANCHOR:EXPORTS] =====

export default function App() {
	return (
		<ErrorBoundary>
			<AppContent />
		</ErrorBoundary>
	);
}
