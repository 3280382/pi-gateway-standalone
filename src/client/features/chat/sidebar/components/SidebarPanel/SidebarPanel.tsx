/**
 * SidebarPanel - Main Sidebar Container
 */

import { useEffect, useRef } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
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
	const workingDir = useSidebarStore((state) => state.workingDir);
	const error = useSidebarStore((state) => state.error);
	const controller = useSidebarController();
	const sessionsLoadedRef = useRef<string | null>(null);

	// Initial data loading
	useEffect(() => {
		// 不再自动加载workingDir，由App.tsx负责初始化以保持持久化状态
		// controller.loadWorkingDir();
		controller.loadRecentWorkspaces();
	}, []);

	// Load sessions when working directory changes
	useEffect(() => {
		console.log('[SidebarPanel] workingDir changed:', workingDir?.path, 'loaded:', sessionsLoadedRef.current);
		if (workingDir?.path && sessionsLoadedRef.current !== workingDir.path) {
			sessionsLoadedRef.current = workingDir.path;
			console.log('[SidebarPanel] Loading sessions for:', workingDir.path);
			controller.loadSessions(workingDir.path);
		}
	}, [workingDir?.path]);

	return (
		<aside
			className={`${styles.sidebar} ${!isVisible ? styles.sidebarHidden : ""}`}
		>
			<SidebarHeader />
			<div className={styles.content}>
				{error && (
					<div className={styles.error}>
						<span>{error}</span>
						<button onClick={controller.clearError}>×</button>
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
