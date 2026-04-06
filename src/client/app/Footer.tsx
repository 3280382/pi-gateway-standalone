/**
 * Footer - 全局底部导航（唯一全局控件）
 * 控制视图切换（Chat/Files）和侧边栏显隐
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import styles from "./Footer.module.css";

export function Footer() {
	const {
		currentView,
		setCurrentView,
		isSidebarVisible,
		toggleSidebar,
		isBottomPanelOpen,
		toggleBottomPanel,
	} = useAppStore();

	// 菜单状态
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isDebugLoaded, setIsDebugLoaded] = useState(false);
	const [isDebugVisible, setIsDebugVisible] = useState(false);
	const [isPageAgentLoaded, setIsPageAgentLoaded] = useState(false);
	const [isPageAgentVisible, setIsPageAgentVisible] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// 点击外部关闭菜单
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// 切换调试系统
	const toggleDebug = useCallback(() => {
		if (!isDebugLoaded) {
			// 加载调试脚本
			if (!document.getElementById("debug-system-script")) {
				const script = document.createElement("script");
				script.id = "debug-system-script";
				script.src = "/debug-system.js";
				script.onload = () => {
					// 脚本加载后自动显示
					if ((window as any).DebugSystem) {
						(window as any).DebugSystem.show();
					}
				};
				document.head.appendChild(script);
			}
			setIsDebugLoaded(true);
			setIsDebugVisible(true);
		} else {
			// 使用 API 隐藏/显示
			const debugSystem = (window as any).DebugSystem;
			if (debugSystem) {
				if (isDebugVisible) {
					debugSystem.hide();
					setIsDebugVisible(false);
				} else {
					debugSystem.show();
					setIsDebugVisible(true);
				}
			}
		}
	}, [isDebugLoaded, isDebugVisible]);

	// 切换 Page Agent
	const togglePageAgent = useCallback(() => {
		if (!isPageAgentLoaded) {
			// 加载 Page Agent 脚本（本地资源）
			if (!document.getElementById("page-agent-script")) {
				const script = document.createElement("script");
				script.id = "page-agent-script";
				script.src = "/vendor/page-agent/page-agent.demo.js";
				script.onload = () => {
					// 脚本加载后，demo 版本会自动显示 UI
					console.log("[Page Agent] Loaded from local");
				};
				document.head.appendChild(script);
			}
			setIsPageAgentLoaded(true);
			setIsPageAgentVisible(true);
		} else {
			// 隐藏/显示切换 - 通过控制 mask 的显示
			const mask = document.querySelector(".page-agent-mask") as HTMLElement;
			if (mask) {
				if (isPageAgentVisible) {
					// 隐藏：将 mask 移出视口而不是销毁
					mask.style.visibility = "hidden";
					mask.style.pointerEvents = "none";
					setIsPageAgentVisible(false);
				} else {
					// 显示：恢复 mask
					mask.style.visibility = "visible";
					mask.style.pointerEvents = "auto";
					setIsPageAgentVisible(true);
				}
			}
		}
	}, [isPageAgentLoaded, isPageAgentVisible]);

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

			{/* 右侧：工具菜单 */}
			<div className={styles.rightGroup} ref={menuRef}>
				<button
					className={`${styles.toolButton} ${isMenuOpen ? styles.active : ""}`}
					onClick={() => setIsMenuOpen(!isMenuOpen)}
					title="Tools"
				>
					<ToolsIcon />
				</button>

				{/* 弹出菜单 */}
				{isMenuOpen && (
					<div className={styles.popupMenu}>
						<button
							className={`${styles.menuItem} ${isDebugVisible ? styles.active : ""}`}
							onClick={toggleDebug}
							title={isDebugVisible ? "Hide Debug" : "Show Debug"}
						>
							<BugIcon />
							<span>Debug</span>
							{isDebugVisible && <CheckIcon />}
						</button>
						<button
							className={`${styles.menuItem} ${isPageAgentVisible ? styles.active : ""}`}
							onClick={togglePageAgent}
							title={isPageAgentVisible ? "Hide Page Agent" : "Show Page Agent"}
						>
							<RobotIcon />
							<span>Page Agent</span>
							{isPageAgentVisible && <CheckIcon />}
						</button>
					</div>
				)}
			</div>
		</nav>
	);
}

// Icon style
const iconStyle: React.CSSProperties = { width: 18, height: 18 };

function LeftArrowIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M19 12H5" />
			<path d="M12 19l-7-7 7-7" />
		</svg>
	);
}

function RightArrowIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M5 12h14" />
			<path d="M12 5l7 7-7 7" />
		</svg>
	);
}

function UpArrowIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 19V5" />
			<path d="M5 12l7-7 7 7" />
		</svg>
	);
}

function DownArrowIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 5v14" />
			<path d="M19 12l-7 7-7-7" />
		</svg>
	);
}

function ChatIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
		</svg>
	);
}

function FilesIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
		</svg>
	);
}

function ToolsIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="3" />
			<path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24 4.24l-4.24-4.24M6.34 6.34L2.1 2.1" />
		</svg>
	);
}

function BugIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="m8 2 1.88 1.88" />
			<path d="M14.12 3.88 16 2" />
			<path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
			<path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
			<path d="M12 20v-9" />
			<path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
			<path d="M6 13H2" />
			<path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
			<path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
			<path d="M22 13h-4" />
			<path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
		</svg>
	);
}

function RobotIcon() {
	return (
		<svg
			style={iconStyle}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 8V4H8" />
			<rect width="16" height="12" x="4" y="8" rx="2" />
			<path d="M2 14h2" />
			<path d="M20 14h2" />
			<path d="M15 13v2" />
			<path d="M9 13v2" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			style={{ width: 14, height: 14 }}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={3}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}
