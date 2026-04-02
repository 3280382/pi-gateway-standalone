/**
 * FilesLayout - 文件功能完整布局
 * 包含：Header、Sidebar、Content、Panel
 */

import { useCallback } from "react";
import { useLayout } from "@/features/core/layout/AppLayout/LayoutContext";
import { AppHeader } from "@/features/core/layout/AppHeader";
import { SidebarPanel } from "@/features/sidebar/components/SidebarPanel/SidebarPanel";
import { XTermPanel } from "@/features/core/layout/panels/TerminalPanel";
import { FileBrowser } from "./components/FileBrowser";
import styles from "./FilesLayout.module.css";

interface FilesLayoutProps {
	terminalOutput: string;
	terminalCommand: string;
	onBashCommand: (command: string) => void;
	onOpenBottomPanel: (command: string) => void;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
}

export function FilesLayout({
	terminalOutput,
	terminalCommand,
	onBashCommand,
	onOpenBottomPanel,
	closeBottomPanel,
	setBottomPanelHeight,
}: FilesLayoutProps) {
	const { isSidebarVisible, isBottomPanelOpen, bottomPanelHeight } = useLayout();

	const renderBottomPanel = useCallback(() => {
		if (!isBottomPanelOpen) return null;

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
	}, [
		isBottomPanelOpen,
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

			{/* Body: Sidebar + Content */}
			<div className={styles.body}>
				{/* Sidebar */}
				{isSidebarVisible && (
					<aside className={styles.sidebar}>
						<SidebarPanel />
					</aside>
				)}

				{/* Content */}
				<main className={styles.content}>
					<FileBrowser
						externalSidebarVisible={false}
						onToggleSidebar={() => {}}
						onExecuteOutput={(output) =>
							console.log("[Files] Execute output:", output)
						}
						onOpenBottomPanel={onOpenBottomPanel}
					/>
					{renderBottomPanel()}
				</main>
			</div>
		</div>
	);
}
