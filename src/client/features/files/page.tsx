/**
 * FilesPage - 文件页面
 */

import { useEffect } from "react";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useSessionStore } from "@/shared/stores/sessionStore";
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

	useEffect(() => {
		if (currentDir && currentPath === "/root") {
			setCurrentPath(currentDir);
		}
	}, []);

	return <FilesLayout {...props} />;
}
