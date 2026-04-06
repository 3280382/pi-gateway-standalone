/**
 * ChatPage - 聊天页面
 */

import { useChatInit, useChatMessages } from "@/features/chat/hooks";
import { ChatLayout } from "@/features/chat/layout";
import styles from "@/features/chat/ChatPage.module.css";

export function ChatPage() {
	const { isConnecting } = useChatInit();
	useChatMessages();

	if (isConnecting) {
		return (
			<div className={styles.loading}>
				<div className={styles.spinner} />
				<p>连接中...</p>
			</div>
		);
	}

	return <ChatLayout />;
}

export default ChatPage;
