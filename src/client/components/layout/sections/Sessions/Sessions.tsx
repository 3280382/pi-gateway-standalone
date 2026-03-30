/**
 * Sessions Section
 * 使用API获取会话列表和加载会话内容
 */

import { useEffect } from "react";
import { useSidebarController } from "@/services/api/sidebarApi";
import { websocketService } from "@/services/websocket.service";
import { useChatStore } from "@/stores/chatStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import type { Session } from "../../../../types/sidebar";
import { IconButton, SectionHeader } from "../../../ui";
import styles from "./Sessions.module.css";

export function Sessions() {
	const sessions = useSidebarStore((state) => state.sessions);
	const selectedId = useSidebarStore((state) => state.selectedSessionId);
	const isLoading = useSidebarStore((state) => state.isLoading);
	const workingDir = useSidebarStore((state) => state.workingDir);
	const controller = useSidebarController();

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
			"path type:",
			typeof sessionPath,
		);

		// 验证 sessionPath
		if (!sessionPath || typeof sessionPath !== "string") {
			console.error("[Sessions] Invalid sessionPath:", sessionPath);
			return;
		}

		// 先选中会话
		controller.selectSession(sessionId);

		// 通过API加载会话文件内容
		try {
			console.log("[Sessions] Fetching session content from API...");
			const response = await fetch("/api/session/load", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionPath }),
			});

			console.log("[Sessions] API response status:", response.status);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("[Sessions] API error response:", errorText);
				throw new Error(
					`Failed to load session: ${response.status} ${errorText}`,
				);
			}

			const data = await response.json();
			console.log("[Sessions] Session data loaded:", data);

			// 将会话内容发送到聊天区域重建
			if (data.entries && data.entries.length > 0) {
				// 使用WebSocket通知服务器加载会话
				websocketService.send("load_session", { sessionPath });

				// 解析消息条目并加载到聊天store
				// 会话文件格式: { type: "message", message: { role, content: [...], timestamp } }
				const messages = data.entries
					.filter((entry: any) => entry.type === "message" && entry.message)
					.map((entry: any) => {
						const msg = entry.message;
						// 转换内容格式
						let content = msg.content;
						// 如果content是字符串，转换为数组格式
						if (typeof content === "string") {
							content = [{ type: "text", text: content }];
						}
						// 如果content是数组，确保格式正确
						else if (Array.isArray(content)) {
							content = content.map((c: any) => {
								if (typeof c === "string") return { type: "text", text: c };
								if (
									c.type === "text" ||
									c.type === "toolCall" ||
									c.type === "toolResult"
								)
									return c;
								return { type: "text", text: String(c) };
							});
						} else {
							content = [{ type: "text", text: JSON.stringify(content) }];
						}

						return {
							id: entry.id || `msg-${Date.now()}-${Math.random()}`,
							role: msg.role || "assistant",
							content: content,
							timestamp: new Date(
								msg.timestamp || entry.timestamp || Date.now(),
							),
							isStreaming: false,
							isThinkingCollapsed: true,
							isMessageCollapsed: false,
						};
					});

				// 更新聊天store
				useChatStore.getState().setMessages(messages);

				console.log(
					`[Sessions] Loaded session: ${sessionId}, ${data.entries.length} entries, ${messages.length} messages`,
				);
			} else {
				console.log("[Sessions] No entries found in session data");
			}
		} catch (err) {
			console.error("[Sessions] Failed to load session:", err);
			console.error("[Sessions] Error details:", {
				name: err instanceof Error ? err.name : "Unknown",
				message: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined,
			});
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
							isSelected={session.id === selectedId}
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
