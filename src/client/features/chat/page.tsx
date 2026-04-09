/**
 * ChatPage - 聊天页面
 *
 * 实现 KeepAlive：首次激活才挂载，之后通过 display 控制显示隐藏
 * 合并了原 ChatLayout 的布局逻辑
 */

import { useCallback, useRef } from "react";
import styles from "@/features/chat/ChatLayout.module.css";
import { ChatPanel } from "@/features/chat/components/ChatPanel";
import { AppHeader } from "@/features/chat/components/Header";
import { SystemPromptModal } from "@/features/chat/components/modals/SystemPromptModal";
import { LlmLogPanel } from "@/features/chat/components/panels/LlmLogPanel";
import { SidebarPanel } from "@/features/chat/components/sidebar/SidebarPanel";
import { useChatInit, useChatMessages } from "@/features/chat/hooks";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";

interface ChatPageProps {
	active?: boolean;
}

export function ChatPage({ active = false }: ChatPageProps) {
	const mountedRef = useRef(false);

	// 总是在顶层调用 Hooks（React Hooks 规则）
	const { isConnecting } = useChatInit();
	useChatMessages();

	// 从 sidebarStore 获取布局状态
	const isSidebarVisible = useSidebarStore((state) => state.isVisible);
	const isBottomPanelOpen = useSidebarStore(
		(state) => state.isBottomPanelOpen ?? false,
	);
	const bottomPanelHeight = useSidebarStore(
		(state) => state.bottomPanelHeight ?? 300,
	);
	const closeBottomPanel = useSidebarStore(
		(state) => state.closeBottomPanel ?? (() => {}),
	);
	const setBottomPanelHeight = useSidebarStore(
		(state) => state.setBottomPanelHeight ?? (() => {}),
	);

	// 渲染底部面板
	const renderBottomPanel = useCallback(() => {
		if (!isBottomPanelOpen) return null;

		return (
			<LlmLogPanel
				height={bottomPanelHeight}
				onClose={closeBottomPanel}
				onHeightChange={setBottomPanelHeight}
			/>
		);
	}, [
		isBottomPanelOpen,
		bottomPanelHeight,
		closeBottomPanel,
		setBottomPanelHeight,
	]);

	// 首次激活时标记为已挂载
	if (active) {
		mountedRef.current = true;
	}

	// 从未激活过，返回 null（配合 React.lazy 实现延迟加载）
	// 注意：这个返回必须在所有 Hooks 调用之后
	if (!mountedRef.current) {
		return null;
	}

	// 连接中状态
	if (isConnecting) {
		return (
			<div
				className={styles.loading}
				style={{
					display: active ? "flex" : "none",
					alignItems: "center",
					justifyContent: "center",
					flexDirection: "column",
					gap: "16px",
					height: "100%",
				}}
			>
				<div
					className={styles.spinner}
					style={{
						width: "40px",
						height: "40px",
						border: "3px solid var(--border-color)",
						borderTopColor: "var(--accent-primary)",
						borderRadius: "50%",
						animation: "spin 1s linear infinite",
					}}
				/>
				<p style={{ color: "var(--text-muted)" }}>连接中...</p>
			</div>
		);
	}

	return (
		<>
			<div
				className={styles.layout}
				style={{ display: active ? "flex" : "none" }}
			>
				{/* Header */}
				<header className={styles.header}>
					<AppHeader />
				</header>

				{/* Body */}
				<div className={styles.body}>
					{/* Sidebar - overlay 模式 */}
					<aside
						className={`${styles.sidebar} ${isSidebarVisible ? styles.sidebarVisible : styles.sidebarHidden}`}
					>
						<SidebarPanel currentView="chat" />
					</aside>

					{/* Content */}
					<main className={styles.content}>
						<ChatPanel />
						{renderBottomPanel()}
					</main>
				</div>
			</div>

			{/* Modals */}
			<SystemPromptModal />
		</>
	);
}

export default ChatPage;
