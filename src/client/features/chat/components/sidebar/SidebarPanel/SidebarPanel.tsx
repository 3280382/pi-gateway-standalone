/**
 * SidebarPanel - Main Sidebar Container
 * 
 * 重构后：
 * - session 加载由 sessionManager 统一处理
 * - SidebarPanel 只负责 UI 渲染
 */

import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { RecentWorkspaces } from "../RecentWorkspaces/RecentWorkspaces";
import { Sessions } from "../Sessions/Sessions";
import { Settings } from "../Settings/Settings";
import styles from "./SidebarPanel.module.css";

interface SidebarPanelProps {
	isVisible: boolean;
	onSwitchView?: (view: "chat" | "files") => void;
	currentView?: "chat" | "files";
}

export function SidebarPanel({
	isVisible,
	onSwitchView,
	currentView = "chat",
}: SidebarPanelProps) {
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
				<Settings />
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
