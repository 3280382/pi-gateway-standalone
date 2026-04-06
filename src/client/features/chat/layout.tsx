/**
 * ChatLayout - 聊天功能布局
 * 包含：Header、Sidebar(overlay)、Content、Panel
 */

import { useCallback } from "react";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { AppHeader } from "@/features/chat/components/Header";
import { LlmLogPanel } from "@/features/chat/components/panels/LlmLogPanel";
import { SidebarPanel } from "@/features/chat/components/sidebar/SidebarPanel/SidebarPanel";
import { ChatPanel } from "@/features/chat/components/ChatPanel";
import styles from "@/features/chat/ChatLayout.module.css";

export function ChatLayout() {
	const isSidebarVisible = useSidebarStore((state) => state.isVisible);
	// Chat 的 bottom panel 状态暂时放在 sidebarStore，后续可分离
	const isBottomPanelOpen = useSidebarStore((state) => state.isBottomPanelOpen ?? false);
	const bottomPanelHeight = useSidebarStore((state) => state.bottomPanelHeight ?? 300);
	const closeBottomPanel = useSidebarStore((state) => state.closeBottomPanel ?? (() => {}));
	const setBottomPanelHeight = useSidebarStore((state) => state.setBottomPanelHeight ?? (() => {}));

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
					<SidebarPanel currentView="chat" />
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
