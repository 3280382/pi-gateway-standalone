/**
 * FilesPage - 文件浏览页面
 * 包含文件浏览器、终端底部面板
 */

import { useCallback, useEffect } from "react";
import { AppLayout } from "@/app/layout/AppLayout";
import { useLayout } from "@/app/layout/AppLayout/LayoutContext";
import { XTermPanel } from "@/app/layout/panels/TerminalPanel";
import { FileBrowser } from "@/features/files/components/FileBrowser";
import { useFileStore } from "@/stores/fileStore";
import { useSessionStore } from "@/stores/sessionStore";

interface FilesPageProps {
	terminalOutput: string;
	terminalCommand: string;
	onBashCommand: (command: string) => void;
	onOpenBottomPanel: (command: string) => void;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
}

export function FilesPage({
	terminalOutput,
	terminalCommand,
	onBashCommand,
	onOpenBottomPanel,
	closeBottomPanel,
	setBottomPanelHeight,
}: FilesPageProps) {
	const { isBottomPanelOpen, bottomPanelHeight } = useLayout();

	// 同步聊天界面的当前目录到文件浏览器
	const { currentDir } = useSessionStore();
	const { currentPath, setCurrentPath } = useFileStore();

	useEffect(() => {
		// 第一次打开文件浏览器时，使用聊天界面的当前目录
		if (currentDir && currentDir !== currentPath) {
			setCurrentPath(currentDir);
		}
	}, [currentDir, currentPath, setCurrentPath]);

	// 处理文件执行输出
	const handleExecuteOutput = useCallback((output: string) => {
		// 更新终端输出显示
		console.log("[FilesPage] Execute output:", output.substring(0, 100));
	}, []);

	// 渲染文件视图的底部面板内容
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
		<AppLayout showInput={false} bottomPanelContent={renderBottomPanel()}>
			<FileBrowser
				externalSidebarVisible={false}
				onToggleSidebar={() => {}}
				onExecuteOutput={handleExecuteOutput}
				onOpenBottomPanel={onOpenBottomPanel}
			/>
		</AppLayout>
	);
}
