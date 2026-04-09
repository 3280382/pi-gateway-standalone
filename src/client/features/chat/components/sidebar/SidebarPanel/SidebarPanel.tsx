/**
 * SidebarPanel - Main Sidebar Container
 *
 * 职责：
 * - 负责侧边栏的整体布局
 * - 协调 RecentWorkspaces, Sessions, ChatSettings 组件
 * - 显示错误信息
 * - 不包含业务逻辑，session 加载由 sessionManager 统一处理
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { ChatSettings } from "@/features/chat/components/sidebar/ChatSettings/ChatSettings";
import { RecentWorkspaces } from "@/features/chat/components/sidebar/RecentWorkspaces/RecentWorkspaces";
import { Sessions } from "@/features/chat/components/sidebar/Sessions/Sessions";
import styles from "@/features/chat/components/sidebar/SidebarPanel/SidebarPanel.module.css";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";

// ============================================================================
// Types
// ============================================================================

interface SidebarPanelProps {
	onSwitchView?: (view: "chat" | "files") => void;
	currentView?: "chat" | "files";
}

// ============================================================================
// Component
// ============================================================================

export function SidebarPanel({
	onSwitchView,
	currentView = "chat",
}: SidebarPanelProps) {
	// ========== 1. State (Domain State from Zustand) ==========
	const isVisible = useSidebarStore((state) => state.isVisible);
	const error = useSidebarStore((state) => state.error);
	const clearError = useSidebarStore((state) => state.clearError);

	// ========== 5. Render ==========
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

// ============================================================================
// Sub-components
// ============================================================================

function SidebarHeader() {
	return (
		<div className={styles.header}>
			<div className={styles.logo}>π</div>
			<span className={styles.title}>Pi Gateway</span>
		</div>
	);
}
