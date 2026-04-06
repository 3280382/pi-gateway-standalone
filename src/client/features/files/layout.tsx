/**
 * FilesLayout - 文件功能布局
 * 包含：FileToolbar、FileSidebar、FileBrowser、Panel
 */

import { useCallback } from "react";
import { useLayout } from "@/app/LayoutContext";
import { FileBottomMenu } from "@/features/files/components/BottomMenu/FileBottomMenu";
import { XTermPanel } from "@/features/files/components/panels/TerminalPanel";
import { useFileStore, useTerminalStore } from "@/features/files/stores";
import { useFileBrowser, useFileNavigation } from "@/features/files/hooks";
import { FileBrowser } from "./components/FileBrowser/FileBrowser";
import { FileSidebar } from "./components/Sidebar/FileSidebar";
import { FileToolbar } from "./components/Header/FileToolbar";
import styles from "./FilesLayout.module.css";

interface FilesLayoutProps {
	isInitializing: boolean;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
}

export function FilesLayout({
	isInitializing,
	closeBottomPanel,
	setBottomPanelHeight,
}: FilesLayoutProps) {
	const { isSidebarVisible, isBottomPanelOpen, bottomPanelHeight } =
		useLayout();
	const { currentPath } = useFileStore();
	const { refresh } = useFileBrowser();
	const { navigateTo } = useFileNavigation();
	const { output, command, setCommand } = useTerminalStore();

	const renderBottomPanel = useCallback(() => {
		if (!isBottomPanelOpen) return null;

		return (
			<XTermPanel
				height={bottomPanelHeight}
				onClose={closeBottomPanel}
				onHeightChange={setBottomPanelHeight}
				output={output}
				initialCommand={command}
				onExecuteCommand={(cmd) => {
					// XTermPanel 内部会执行命令，这里只更新状态
					setCommand(cmd);
				}}
			/>
		);
	}, [
		isBottomPanelOpen,
		bottomPanelHeight,
		output,
		command,
		closeBottomPanel,
		setBottomPanelHeight,
		setCommand,
	]);

	// 初始化中显示加载状态
	if (isInitializing) {
		return (
			<div className={styles.layout}>
				<div
					style={{
						flex: 1,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "var(--text-secondary)",
					}}
				>
					Loading...
				</div>
			</div>
		);
	}

	return (
		<div className={styles.layout}>
			{/* FileToolbar - 文件浏览器专用顶部工具栏 */}
			<header className={styles.header}>
				<FileToolbar
					currentPath={currentPath}
					onRefresh={refresh}
					onNavigate={navigateTo}
				/>
			</header>

			{/* Body: FileSidebar + Content */}
			<div className={styles.body}>
				{/* FileSidebar - 异步加载的目录树 */}
				<FileSidebar visible={isSidebarVisible} onNavigate={navigateTo} />

				{/* Content */}
				<main className={styles.content}>
					<FileBrowser
						onExecuteOutput={(output) =>
							console.log("[Files] Execute output:", output)
						}
						onOpenBottomPanel={setCommand}
					/>
					{renderBottomPanel()}
				</main>
			</div>

			{/* FileBottomMenu - 文件功能底部菜单 */}
			<FileBottomMenu />
		</div>
	);
}
