/**
 * ChatPage - 聊天页面
 */

import { useChatMessages } from "./hooks";
import { ChatLayout } from "./layout";

export function ChatPage() {
	useChatMessages();
	return <ChatLayout />;
}
