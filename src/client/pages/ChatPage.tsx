/**
 * ChatPage - 聊天页面
 * 包含消息列表、输入框、LLM日志底部面板
 */

import { useCallback } from "react";
import { MessageList } from "@/features/chat/components/MessageList/MessageList";
import { AppLayout } from "@/app/layout/AppLayout";
import { useLayout } from "@/app/layout/AppLayout/LayoutContext";
import { LlmLogPanel } from "@/app/layout/panels/LlmLogPanel";
import { XTermPanel } from "@/app/layout/panels/TerminalPanel";
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

export function ChatPage({
	terminalOutput,
	terminalCommand,
	commandResults,
	isExecuting,
	onBashCommand,
	onSlashCommand,
	closeBottomPanel,
	setBottomPanelHeight,
}: ChatPageProps) {
	const { isBottomPanelOpen, bottomPanelHeight } = useLayout();

	const {
		filteredMessages,
		currentStreamingMessage,
		showThinking,
		toggleMessageCollapse,
		toggleThinkingCollapse,
		toggleToolsCollapse,
	} = useChatMessages();

	// 渲染聊天视图的底部面板内容
	const renderBottomPanel = useCallback(() => {
		if (!isBottomPanelOpen) return null;

		// 如果有命令执行结果，显示终端面板
		if (commandResults.length > 0 || isExecuting) {
			return (
				<XTermPanel
					height={bottomPanelHeight}
					onClose={closeBottomPanel}
					onHeightChange={setBottomPanelHeight}
					output={terminalOutput}
					initialCommand={terminalCommand}
					onExecuteCommand={onBashCommand}
				/>
			);
		}

		return (
			<LlmLogPanel
				height={bottomPanelHeight}
				onClose={closeBottomPanel}
				onHeightChange={setBottomPanelHeight}
			/>
		);
	}, [
		isBottomPanelOpen,
		commandResults.length,
		isExecuting,
		bottomPanelHeight,
		terminalOutput,
		terminalCommand,
		closeBottomPanel,
		setBottomPanelHeight,
		onBashCommand,
	]);

	return (
		<AppLayout
			showInput={true}
			bottomPanelContent={renderBottomPanel()}
			onBashCommand={onBashCommand}
			onSlashCommand={onSlashCommand}
		>
			<MessageList
				messages={filteredMessages}
				currentStreamingMessage={currentStreamingMessage}
				showThinking={showThinking}
				onToggleMessageCollapse={toggleMessageCollapse}
				onToggleThinkingCollapse={toggleThinkingCollapse}
				onToggleToolsCollapse={toggleToolsCollapse}
			/>
		</AppLayout>
	);
}
