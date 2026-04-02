/**
 * FilesLayout - 文件功能布局
 * 包含：FileToolbar、FileSidebar、FileBrowser、Panel
 */

import { useCallback } from "react";
import { useLayout } from "@/core/layout/LayoutContext";
import { FileToolbar } from "./components/FileToolbar";
import { FileSidebar } from "./components/FileSidebar";
import { XTermPanel } from "@/core/layout/panels/TerminalPanel";
import { FileBrowser } from "./components/FileBrowser";
import { useFileStore } from "@/stores/fileStore";
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
	const { currentPath, loadDirectory, setCurrentPath } = useFileStore();

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
			{/* FileToolbar - 文件浏览器专用顶部工具栏 */}
			<header className={styles.header}>
				<FileToolbar
					currentPath={currentPath}
					onRefresh={() => loadDirectory(currentPath)}
					onNavigate={setCurrentPath}
				/>
			</header>

			{/* Body: FileSidebar + Content */}
			<div className={styles.body}>
				{/* FileSidebar - 异步加载的目录树 */}
				<FileSidebar
					visible={isSidebarVisible}
					onNavigate={setCurrentPath}
				/>

				{/* Content */}
				<main className={styles.content}>
					<FileBrowser
						externalSidebarVisible={isSidebarVisible}
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
