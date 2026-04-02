/**
 * Footer - 全局底部导航（唯一全局控件）
 * 控制视图切换（Chat/Files）和侧边栏显隐
 */

import { useLayout } from "@/core/layout/AppLayout/LayoutContext";
import styles from "./Footer.module.css";

export function Footer() {
	const {
		currentView,
		setCurrentView,
		isSidebarVisible,
		toggleSidebar,
		isBottomPanelOpen,
		toggleBottomPanel,
	} = useLayout();

	return (
		<nav className={styles.footer}>
			{/* 左侧：侧边栏和面板切换 */}
			<div className={styles.leftGroup}>
				<button
					className={`${styles.button} ${isSidebarVisible ? styles.active : ""}`}
					onClick={toggleSidebar}
					title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
				>
					{isSidebarVisible ? <LeftArrowIcon /> : <RightArrowIcon />}
				</button>

				<button
					className={`${styles.button} ${isBottomPanelOpen ? styles.active : ""}`}
					onClick={() => toggleBottomPanel("terminal")}
					title={isBottomPanelOpen ? "Hide Panel" : "Show Panel"}
				>
					{isBottomPanelOpen ? <DownArrowIcon /> : <UpArrowIcon />}
				</button>
			</div>

			{/* 中间：视图切换 */}
			<div className={styles.centerGroup}>
				<button
					className={`${styles.button} ${currentView === "chat" ? styles.active : ""}`}
					onClick={() => setCurrentView("chat")}
					title="Chat"
				>
					<ChatIcon />
					<span>Chat</span>
				</button>

				<button
					className={`${styles.button} ${currentView === "files" ? styles.active : ""}`}
					onClick={() => setCurrentView("files")}
					title="Files"
				>
					<FilesIcon />
					<span>Files</span>
				</button>
			</div>

			{/* 右侧占位，保持对称 */}
			<div className={styles.rightGroup} />
		</nav>
	);
}

// Icon style
const iconStyle: React.CSSProperties = { width: 18, height: 18 };

function LeftArrowIcon() {
	return (
		<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
			<path d="M19 12H5" />
			<path d="M12 19l-7-7 7-7" />
		</svg>
	);
}

function RightArrowIcon() {
	return (
		<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
			<path d="M5 12h14" />
			<path d="M12 5l7 7-7 7" />
		</svg>
	);
}

function UpArrowIcon() {
	return (
		<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 19V5" />
			<path d="M5 12l7-7 7 7" />
		</svg>
	);
}

function DownArrowIcon() {
	return (
		<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 5v14" />
			<path d="M19 12l-7 7-7-7" />
		</svg>
	);
}

function ChatIcon() {
	return (
		<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
			<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
		</svg>
	);
}

function FilesIcon() {
	return (
		<svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
			<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
		</svg>
	);
}
