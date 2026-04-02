/**
 * ChatLayout - 聊天功能布局
 * 包含：Header、Sidebar(overlay)、Content、Panel
 */

import { useCallback } from "react";
import { useLayout } from "@/core/layout/AppLayout/LayoutContext";
import { AppHeader } from "@/core/layout/AppHeader";
import { SidebarPanel } from "@/features/chat/sidebar/components/SidebarPanel/SidebarPanel";
import { LlmLogPanel } from "@/core/layout/panels/LlmLogPanel";
import { XTermPanel } from "@/core/layout/panels/TerminalPanel";
import type { CommandResult } from "@/hooks/app";
import { ChatPanel } from "./components/ChatPanel";
import styles from "./ChatLayout.module.css";

interface ChatLayoutProps {
	terminalOutput: string;
	terminalCommand: string;
	commandResults: CommandResult[];
	isExecuting: boolean;
	onBashCommand: (command: string) => void;
	onSlashCommand: (command: string, args: string) => void;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
}

export function ChatLayout({
	terminalOutput,
	terminalCommand,
	commandResults,
	isExecuting,
	onBashCommand,
	closeBottomPanel,
	setBottomPanelHeight,
}: ChatLayoutProps) {
	const { isSidebarVisible, isBottomPanelOpen, bottomPanelHeight } = useLayout();

	const renderBottomPanel = useCallback(() => {
		if (!isBottomPanelOpen) return null;

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
		<div className={styles.layout}>
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
					<SidebarPanel isVisible={isSidebarVisible} currentView="chat" />
				</aside>

				{/* Content */}
				<main className={styles.content}>
					<ChatPanel />
					{renderBottomPanel()}
				</main>
			</div>
		</div>
	);
}
