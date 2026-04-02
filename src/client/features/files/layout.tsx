/**
 * FilesLayout - 文件功能布局
 */

import { useCallback } from "react";
import { useLayout } from "@/features/core/layout/AppLayout/LayoutContext";
import { XTermPanel } from "@/features/core/layout/panels/TerminalPanel";
import { FileBrowser } from "./components/FileBrowser";

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
	const { isBottomPanelOpen, bottomPanelHeight } = useLayout();

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
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<FileBrowser
				externalSidebarVisible={false}
				onToggleSidebar={() => {}}
				onExecuteOutput={(output) =>
					console.log("[Files] Execute output:", output)
				}
				onOpenBottomPanel={onOpenBottomPanel}
			/>
			{renderBottomPanel()}
		</div>
	);
}
