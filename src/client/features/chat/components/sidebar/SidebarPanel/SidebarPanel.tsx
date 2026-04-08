/**
 * SidebarPanel - Main Sidebar Container
 *
 * 重构后：
 * - session 加载由 sessionManager 统一处理
 * - SidebarPanel 只负责 UI 渲染
 */

import { ChatSettings } from "@/features/chat/components/sidebar/ChatSettings/ChatSettings";
import { RecentWorkspaces } from "@/features/chat/components/sidebar/RecentWorkspaces/RecentWorkspaces";
import { Sessions } from "@/features/chat/components/sidebar/Sessions/Sessions";
import styles from "@/features/chat/components/sidebar/SidebarPanel/SidebarPanel.module.css";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";

interface SidebarPanelProps {
	onSwitchView?: (view: "chat" | "files") => void;
	currentView?: "chat" | "files";
}

export function SidebarPanel({
	onSwitchView,
	currentView = "chat",
}: SidebarPanelProps) {
	const isVisible = useSidebarStore((state) => state.isVisible);
	const error = useSidebarStore((state) => state.error);
	const clearError = useSidebarStore((state) => state.clearError);

	return (
		<aside
			className={`${styles.sidebar} ${!isVisible ? styles.sidebarHidden : ""}`}
		>
			<SidebarHeader />
			<div className={styles.content}>
				{error && (
					<div className={styles.error}>
						<span>{error}</span>
						<button onClick={clearError}>×</button>
					</div>
				)}
				<RecentWorkspaces />
				{currentView === "chat" && <Sessions />}
				{currentView === "chat" && <ChatSettings />}
			</div>
		</aside>
	);
}

function SidebarHeader() {
	return (
		<div className={styles.header}>
			<div className={styles.logo}>π</div>
			<span className={styles.title}>Pi Gateway</span>
		</div>
	);
}
