/**
 * ChatLayout - 聊天功能布局
 * 包含：Header、Sidebar(overlay)、Content、Panel
 */

import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { AppHeader } from "@/features/chat/components/Header";
import { LlmLogPanel } from "@/features/chat/components/panels/LlmLogPanel";
import { SidebarPanel } from "@/features/chat/components/sidebar/SidebarPanel/SidebarPanel";
import styles from "./ChatLayout.module.css";
import { ChatPanel } from "./components/ChatPanel";

export function ChatLayout() {
	const {
		isSidebarVisible,
		isBottomPanelOpen,
		bottomPanelHeight,
		closeBottomPanel,
		setBottomPanelHeight,
	} = useAppStore();

	const renderBottomPanel = useCallback(() => {
		if (!isBottomPanelOpen) return null;

		return (
			<LlmLogPanel
				height={bottomPanelHeight}
				onClose={closeBottomPanel}
				onHeightChange={setBottomPanelHeight}
			/>
		);
	}, [
		isBottomPanelOpen,
		bottomPanelHeight,
		closeBottomPanel,
		setBottomPanelHeight,
	]);

	return (
		<div className={styles.layout}>
			{/* Header */}
			<header className={styles.header}>
				<AppHeader />
			</header>

			{/* Body */}
			<div className={styles.body}>
				{/* Sidebar - overlay 模式 */}
				<aside
					className={`${styles.sidebar} ${isSidebarVisible ? styles.sidebarVisible : styles.sidebarHidden}`}
				>
					<SidebarPanel isVisible={isSidebarVisible} currentView="chat" />
				</aside>

				{/* Content */}
				<main className={styles.content}>
					<ChatPanel />
					{renderBottomPanel()}
				</main>
			</div>
		</div>
	);
}
