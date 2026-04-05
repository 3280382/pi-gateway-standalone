/**
 * Sessions Section
 * 
 * 重构后：
 * - 使用 sessionManager 处理 session 选择和加载
 * - 只负责 UI 渲染
 */

import { sessionManager } from "@/features/chat/services/sessionManager";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import { IconButton } from "@/components/IconButton/IconButton";
import { SectionHeader } from "@/features/chat/components/SectionHeader/SectionHeader";
import styles from "./Sessions.module.css";

export function Sessions() {
	const sessions = useSidebarStore((state) => state.sessions);
	const selectedId = useSidebarStore((state) => state.selectedSessionId);
	const isLoading = useSidebarStore((state) => state.isLoading);

	const handleNewSession = () => {
		sessionManager.createNewSession();
	};

	const handleSelectSession = (sessionId: string) => {
		sessionManager.selectSession(sessionId);
	};

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
					<IconButton onClick={handleNewSession} title="New Session">
						<PlusIcon />
					</IconButton>
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
							isSelected={session.id === selectedId || session.path.includes(selectedId || "")}
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
