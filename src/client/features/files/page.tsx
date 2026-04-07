/**
 * FilesPage - 文件页面
 *
 * 职责：文件功能完整布局
 * - 包含 FileToolbar、FileSidebar、FileBrowser、Panel、BottomMenu
 * - 所有状态通过 Hooks 内部获取
 * - 实现 KeepAlive：首次激活才挂载，之后通过 display 控制显示隐藏
 */

import { useCallback, useRef } from "react";
import { FileBottomMenu } from "@/features/files/components/BottomMenu/FileBottomMenu";
import { XTermPanel } from "@/features/files/components/panels/TerminalPanel";
import { useFileStore, useTerminalStore } from "@/features/files/stores";
import { useFileBrowser, useFileNavigation } from "@/features/files/hooks";
import { FileBrowser } from "@/features/files/components/FileBrowser/FileBrowser";
import { FileSidebar } from "@/features/files/components/Sidebar/FileSidebar";
import { FileToolbar } from "@/features/files/components/Header/FileToolbar";
import styles from "@/features/files/FilesLayout.module.css";

interface FilesPageProps {
	active?: boolean;
}

export function FilesPage({ active = false }: FilesPageProps) {
	const mountedRef = useRef(false);

	// 总是在顶层调用 Hooks（React Hooks 规则）
	const {
		currentPath,
		isSidebarVisible,
		isBottomPanelOpen,
		bottomPanelHeight,
		closeBottomPanel,
		setBottomPanelHeight,
	} = useFileStore();
	const { refresh } = useFileBrowser();
	const { navigateTo } = useFileNavigation();
	const { output, command, setCommand } = useTerminalStore();

	// 首次激活时标记为已挂载
	if (active) {
		mountedRef.current = true;
	}

	// useCallback 必须在条件返回之前调用（React Hooks 规则）
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
	// 从未激活过，返回 null（配合 React.lazy 实现延迟加载）
	// 注意：这个返回必须在所有 Hooks 调用之后
	if (!mountedRef.current) {
		return null;
	}


	return (
		<div
			className={styles.layout}
			style={{ display: active ? "block" : "none" }}
		>
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

export default FilesPage;
