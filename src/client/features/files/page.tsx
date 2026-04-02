/**
 * FilesPage - 文件页面
 * 包装 FilesLayout 并提供数据
 */

import { useCallback, useEffect } from "react";
import { useFileStore } from "@/stores/fileStore";
import { useSessionStore } from "@/stores/sessionStore";
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
	const { currentDir } = useSessionStore();
	const { currentPath, setCurrentPath } = useFileStore();

	// 同步聊天界面的当前目录到文件浏览器（只在组件挂载时执行一次）
	useEffect(() => {
		if (currentDir && currentPath === "/root") {
			setCurrentPath(currentDir);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return <FilesLayout {...props} />;
}
