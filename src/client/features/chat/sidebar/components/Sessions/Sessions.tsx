/**
 * Sessions Section
 * 使用API获取会话列表和加载会话内容
 */

import { useEffect } from "react";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { websocketService } from "@/shared/services/websocket.service";
import { useSessionStore } from "@/shared/stores/sessionStore";
import { IconButton } from "@/shared/ui/IconButton/IconButton";
import { SectionHeader } from "@/shared/ui/SectionHeader/SectionHeader";
import type { Session } from "../../../../types/sidebar";
import styles from "./Sessions.module.css";

export function Sessions() {
	const sessions = useSidebarStore((state) => state.sessions);
	const sidebarSelectedId = useSidebarStore((state) => state.selectedSessionId);
	const isLoading = useSidebarStore((state) => state.isLoading);
	const workingDir = useSidebarStore((state) => state.workingDir);
	const controller = useSidebarController();

	// 从sessionStore获取当前session ID用于激活样式
	const currentSessionId = useSessionStore((state) => state.currentSessionId);

	// 优先使用sessionStore的currentSessionId，如果没有则使用sidebarStore的selectedSessionId
	const selectedId = currentSessionId || sidebarSelectedId;

	// 调试信息

	// 检查session是否匹配的辅助函数（支持短ID匹配完整路径）
	const isSessionSelected = (sessionId: string): boolean => {
		if (!selectedId) return false;
		// 完全匹配
		if (sessionId === selectedId) return true;
		// sessionId 是完整路径，selectedId 是短ID（提取文件名中的UUID部分匹配）
		const fileName = sessionId.split("/").pop() || "";
		return fileName.includes(selectedId);
	};

	// 当工作目录变化时加载会话列表
	useEffect(() => {
		if (workingDir?.path) {
			controller.loadSessions(workingDir.path);
		}
	}, [workingDir?.path]);

	const handleNewSession = () => {
		controller.createNewSession();
	};

	const handleSelectSession = async (
		sessionId: string,
		sessionPath: string,
	) => {
		console.log(
			"[Sessions] Selecting session:",
			sessionId,
			"path:",
			sessionPath,
		);

		// 验证 sessionPath
		if (!sessionPath || typeof sessionPath !== "string") {
			console.error("[Sessions] Invalid sessionPath:", sessionPath);
			return;
		}

		// 先选中会话（UI状态）
		controller.selectSession(sessionId);

		// 保存session ID到sessionStore用于持久化
		useSessionStore.getState().setCurrentSession(sessionId);

		// 使用统一的 chatStore.loadSession 加载会话消息
		// 这个函数和 App.tsx 首次加载使用相同的转换逻辑
		try {
			console.log("[Sessions] Loading session via chatStore...");
			const messageCount = await useChatStore
				.getState()
				.loadSession(sessionPath);
			console.log(
				`[Sessions] Loaded ${messageCount} messages from ${sessionId}`,
			);

			// 通知WebSocket服务器会话已切换
			websocketService.send("load_session", { sessionPath });
		} catch (err) {
			console.error("[Sessions] Failed to load session:", err);
		}
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
							isSelected={isSessionSelected(session.id)}
							onClick={() => handleSelectSession(session.id, session.path)}
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
