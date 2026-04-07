/**
 * ChatPage - 聊天页面
 *
 * 实现 KeepAlive：首次激活才挂载，之后通过 display 控制显示隐藏
 */

import { useRef } from "react";
import { useChatInit, useChatMessages } from "@/features/chat/hooks";
import { ChatLayout } from "@/features/chat/layout";
import styles from "@/features/chat/ChatPage.module.css";

interface ChatPageProps {
	active?: boolean;
}

export function ChatPage({ active = false }: ChatPageProps) {
	const mountedRef = useRef(false);

	// 首次激活时标记为已挂载
	if (active) {
		mountedRef.current = true;
	}

	// 从未激活过，返回 null（配合 React.lazy 实现延迟加载）
	if (!mountedRef.current) {
		return null;
	}

	const { isConnecting } = useChatInit();
	useChatMessages();

	if (isConnecting) {
		return (
			<div
				className={styles.loading}
				style={{ display: active ? "flex" : "none" }}
			>
				<div className={styles.spinner} />
				<p>连接中...</p>
			</div>
		);
	}

	return (
		<div style={{ display: active ? "block" : "none", height: "100%" }}>
			<ChatLayout />
		</div>
	);
}

export default ChatPage;
