/**
 * SidebarPanel - Main Sidebar Container
 *
 * 职责：
 * - 负责侧边栏的整体布局
 * - 包含所有sidebar子组件（RecentWorkspaces, Sessions, ChatSettings）
 * - 显示错误信息
 * - 不包含业务逻辑，session加载由sessionManager统一处理
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { useCallback } from "react";
import { IconButton } from "@/components/Icon/Icon";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { useLlmLogStore } from "@/features/chat/stores/llmLogStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import { useWorkspaceStore } from "@/features/files/stores";
import styles from "./SidebarPanel.module.css";

// ============================================================================
// Types
// ============================================================================

interface SidebarPanelProps {
	onSwitchView?: (view: "chat" | "files") => void;
	currentView?: "chat" | "files";
}

// ============================================================================
// Main Component
// ============================================================================

export function SidebarPanel({ currentView = "chat" }: SidebarPanelProps) {
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
				<RecentWorkspacesSection />
				{currentView === "chat" && <SessionsSection />}
				{currentView === "chat" && <ChatSettingsSection />}
			</div>
		</aside>
	);
}

// ============================================================================
// Sub-components (合并到此文件，减少文件数量)
// ============================================================================

function SidebarHeader() {
	return (
		<div className={styles.header}>
			<div className={styles.logo}>π</div>
			<span className={styles.title}>Pi Gateway</span>
		</div>
	);
}

/**
 * RecentWorkspaces Section
 */
function RecentWorkspacesSection() {
	// ========== 1. State ==========
	const recentWorkspaces = useWorkspaceStore((state) => state.recentWorkspaces);
	const clearRecentWorkspaces = useWorkspaceStore(
		(state) => state.clearRecentWorkspaces,
	);
	const workingDir = useSidebarStore((state) => state.workingDir);
	const isLoading = useSidebarStore((state) => state.isLoading);
	const controller = useSidebarController();

	// ========== 4. Computed ==========
	const currentPath = workingDir?.path || "";

	// ========== 5. Actions ==========
	const handleClear = useCallback(() => {
		clearRecentWorkspaces();
	}, [clearRecentWorkspaces]);

	const handleSelect = useCallback(
		(path: string) => {
			controller.changeWorkingDir(path);
		},
		[controller],
	);

	// ========== 6. Render ==========
	if (isLoading && recentWorkspaces.length === 0) {
		return (
			<section className={styles.section}>
				<SectionHeader title="Recent Workspaces" />
				<div className={styles.loading}>Loading...</div>
			</section>
		);
	}

	if (recentWorkspaces.length === 0) {
		return (
			<section className={styles.section}>
				<SectionHeader title="Recent Workspaces" />
				<div className={styles.empty}>No recent workspaces</div>
			</section>
		);
	}

	return (
		<section className={styles.section}>
			<SectionHeader
				title="Recent Workspaces"
				action={
					<IconButton name="trash" onClick={handleClear} title="Clear Recent" />
				}
			/>
			<div className={styles.list}>
				{recentWorkspaces.map((workspace) => {
					const path = workspace.replace(/\/$/, "");
					const name = path.split("/").pop() || path;
					const isActive = currentPath === path || currentPath === workspace;

					return (
						<button
							key={path}
							className={`${styles.item} ${isActive ? styles.active : ""}`}
							onClick={() => handleSelect(path)}
							title={path}
						>
							<FolderIcon />
							<div className={styles.info}>
								<span className={styles.name}>{name}</span>
								<span className={styles.path}>{path}</span>
							</div>
						</button>
					);
				})}
			</div>
		</section>
	);
}

/**
 * Sessions Section
 */
function SessionsSection() {
	// ========== 1. State ==========
	const sessions = useSidebarStore((state) => state.sessions);
	const selectedId = useSidebarStore((state) => state.selectedSessionId);
	const isLoading = useSidebarStore((state) => state.isLoading);

	// ========== 4. Actions ==========
	const handleNewSession = useCallback(() => {
		sessionManager.createNewSession();
	}, []);

	const handleSelectSession = useCallback((sessionId: string) => {
		sessionManager.selectSession(sessionId);
	}, []);

	// ========== 5. Render ==========
	if (isLoading && sessions.length === 0) {
		return (
			<section className={styles.section}>
				<SectionHeader title="Sessions" />
				<div className={styles.loading}>Loading...</div>
			</section>
		);
	}

	return (
		<section className={styles.section}>
			<SectionHeader
				title="Sessions"
				action={
					<IconButton
						name="plus"
						onClick={handleNewSession}
						title="New Session"
					/>
				}
			/>
			<div className={styles.list}>
				{sessions.length === 0 ? (
					<div className={styles.empty}>No sessions yet</div>
				) : (
					sessions.map((session) => (
						<SessionItem
							key={session.id}
							session={session}
							isSelected={
								session.id === selectedId ||
								session.path.includes(selectedId || "")
							}
							onClick={() => handleSelectSession(session.id)}
						/>
					))
				)}
			</div>
		</section>
	);
}

function SessionItem({
	session,
	isSelected,
	onClick,
}: {
	session: Session;
	isSelected: boolean;
	onClick: () => void;
}) {
	const timeStr = new Date(session.lastModified).toLocaleDateString();

	return (
		<button
			className={`${styles.item} ${isSelected ? styles.selected : ""}`}
			onClick={onClick}
			title={session.name}
		>
			<div className={styles.icon}>
				<MessageIcon />
			</div>
			<div className={styles.info}>
				<div className={styles.name}>{session.name}</div>
				<div className={styles.meta}>
					{timeStr} • {session.messageCount} msgs
				</div>
			</div>
		</button>
	);
}

/**
 * ChatSettings Section
 */
function ChatSettingsSection() {
	// ========== 1. State ==========
	const llmLogConfig = useLlmLogStore((state) => state.config);
	const setLlmLogConfig = useLlmLogStore((state) => state.setConfig);
	const openLlmLog = useModalStore((state) => state.openLlmLog);

	// ========== 5. Render ==========
	return (
		<section className={styles.section}>
			<div className={styles.sectionHeader}>Chat Settings</div>

			<div className={styles.setting}>
				<span className={styles.label}>LLM Log</span>
				<div className={styles.controls}>
					<button
						className={`${styles.toggleBtn} ${llmLogConfig.enabled ? styles.enabled : ""}`}
						onClick={() => setLlmLogConfig({ enabled: !llmLogConfig.enabled })}
						title={
							llmLogConfig.enabled ? "Logging enabled" : "Logging disabled"
						}
					>
						<LogIcon />
						<span>{llmLogConfig.enabled ? "On" : "Off"}</span>
					</button>
					<button
						className={styles.viewBtn}
						onClick={openLlmLog}
						title="View LLM Logs"
					>
						<ViewIcon />
					</button>
				</div>
			</div>

			{llmLogConfig.enabled && (
				<div className={styles.setting}>
					<span className={styles.label}>Refresh</span>
					<select
						className={styles.select}
						value={llmLogConfig.refreshInterval}
						onChange={(e) =>
							setLlmLogConfig({ refreshInterval: Number(e.target.value) })
						}
					>
						<option value={1}>1s</option>
						<option value={5}>5s</option>
						<option value={10}>10s</option>
						<option value={30}>30s</option>
						<option value={60}>1m</option>
					</select>
				</div>
			)}
		</section>
	);
}

// ============================================================================
// Shared UI Components (内联，减少文件)
// ============================================================================

function SectionHeader({
	title,
	action,
}: {
	title: string;
	action?: React.ReactNode;
}) {
	return (
		<div className={styles.sectionHeader}>
			<span className={styles.sectionTitle}>{title}</span>
			{action && <div className={styles.sectionAction}>{action}</div>}
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function FolderIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
		</svg>
	);
}

function MessageIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
		</svg>
	);
}

function LogIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
		</svg>
	);
}

function ViewIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}
