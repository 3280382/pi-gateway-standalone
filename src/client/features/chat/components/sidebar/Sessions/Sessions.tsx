/**
 * Sessions Section - Sidebar Sessions List
 *
 * 职责：
 * - 显示会话列表
 * - 处理会话选择和新会话创建
 * - 不包含业务逻辑，通过 sessionManager 处理
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { useCallback } from "react";
import { IconButton } from "@/components/Icon/Icon";
import { SectionHeader } from "@/features/chat/components/SectionHeader/SectionHeader";
import styles from "@/features/chat/components/sidebar/Sessions/Sessions.module.css";
import { sessionManager } from "@/features/chat/services/sessionManager";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";

// ============================================================================
// Component
// ============================================================================

export function Sessions() {
	// ========== 1. State (Domain State from Zustand) ==========
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

function PlusIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
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
