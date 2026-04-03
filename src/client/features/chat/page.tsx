/**
 * ChatPage - 聊天页面
 */

import { useChatMessages } from "@/shared/hooks/app";
import { ChatLayout } from "./layout";

interface ChatPageProps {
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
}

export function ChatPage(props: ChatPageProps) {
	useChatMessages();
	return <ChatLayout {...props} />;
}
