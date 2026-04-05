/**
 * FilesPage - 文件页面
 */

import { useEffect, useState } from "react";
import { initializeFilePath, useFileStore } from "@/features/files/stores/fileStore";
import { FilesLayout } from "./layout";

interface FilesPageProps {
	terminalOutput: string;
	terminalCommand: string;
	onBashCommand: (command: string) => void;
	onOpenBottomPanel: (command: string) => void;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
}

export function FilesPage(props: FilesPageProps) {
	const { setCurrentPath } = useFileStore();
	const [isInitializing, setIsInitializing] = useState(true);

	useEffect(() => {
		// 初始化文件浏览器路径
		const initPath = async () => {
			const path = await initializeFilePath();
			setCurrentPath(path);
			setIsInitializing(false);
		};

		initPath();
	}, [setCurrentPath]);

	// 初始化完成前显示加载状态
	if (isInitializing) {
		return (
			<div style={{ 
				flex: 1, 
				display: "flex", 
				alignItems: "center", 
				justifyContent: "center",
				color: "var(--text-secondary)"
			}}>
				Loading...
			</div>
		);
	}

	return <FilesLayout {...props} />;
}
