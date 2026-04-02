/**
 * ChatPage - 聊天页面
 * 包装 ChatLayout 并提供数据
 */

import { ChatLayout } from "./layout";
import type { CommandResult } from "@/hooks/app";
import { useChatMessages } from "@/hooks/app";

interface ChatPageProps {
	terminalOutput: string;
	terminalCommand: string;
	commandResults: CommandResult[];
	isExecuting: boolean;
	onBashCommand: (command: string) => void;
	onSlashCommand: (command: string, args: string) => void;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
}

export function ChatPage(props: ChatPageProps) {
	// 使用聊天消息 hook
	useChatMessages();

	return <ChatLayout {...props} />;
}
