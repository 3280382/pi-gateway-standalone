/**
 * FilesPage - 文件页面
 *
 * 职责：文件功能完整布局
 * - 包含 FileToolbar、FileSidebar、FileBrowser、Panel、BottomMenu
 * - 所有状态通过 Hooks 内部获取
 * - 实现 KeepAlive：首次激活才挂载，之后通过 display 控制显示隐藏
 */

import { useRef } from "react";
import { FileBottomMenu } from "@/features/files/components/BottomMenu/FileBottomMenu";
import { FileBrowser } from "@/features/files/components/FileBrowser/FileBrowser";
import { FileToolbar } from "@/features/files/components/Header/FileToolbar";
import { TerminalPanel } from "@/features/files/components/panels/TerminalPanel";
import { FileSidebar } from "@/features/files/components/Sidebar/FileSidebar";
import styles from "@/features/files/FilesLayout.module.css";
import { useFileBrowser, useFileNavigation } from "@/features/files/hooks";
import { useFileStore, useViewerStore } from "@/features/files/stores";

interface FilesPageProps {
	active?: boolean;
}

export function FilesPage({ active = false }: FilesPageProps) {
	// ========== 1. State ==========
	// 使用ref跟踪挂载状态
	const hasMountedRef = useRef(false);

	// 从store获取布局状态
	const {
		currentPath,
		isSidebarVisible,
		isBottomPanelOpen,
		bottomPanelHeight,
		closeBottomPanel,
		setBottomPanelHeight,
	} = useFileStore();

	// 从viewer store获取终端状态
	const { terminalOutput, terminalCommand, setTerminalCommand } = useViewerStore();

	// ========== 2. Ref ==========
	// hasMountedRef已在上面定义

	// ========== 3. Effects ==========
	// 使用useFileBrowser hook管理初始化和副作用
	const { refresh } = useFileBrowser();

	// ========== 4. Computed ==========
	// 首次激活时标记为已挂载
	if (active) {
		hasMountedRef.current = true;
	}

	// 从导航hook获取
	const { navigateTo } = useFileNavigation();

	// ========== 5. Actions ==========
	// 通过hooks获取

	// ========== 6. Render ==========
	// 从未激活过，返回 null（配合 React.lazy 实现延迟加载）
	// 注意：这个返回必须在所有 Hooks 调用之后
	if (!hasMountedRef.current) {
		return null;
	}

	return (
		<div
			className={styles.layout}
			style={{ display: active ? "flex" : "none" }}
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
						onOpenBottomPanel={setTerminalCommand}
					/>
					{isBottomPanelOpen && (
						<TerminalPanel
							height={bottomPanelHeight}
							onClose={closeBottomPanel}
							onHeightChange={setBottomPanelHeight}
							initialCommand={terminalCommand}
							onExecuteCommand={(cmd) => {
								setTerminalCommand(cmd);
							}}
						/>
					)}
				</main>
			</div>

			{/* FileBottomMenu - 文件功能底部菜单 */}
			<FileBottomMenu />
		</div>
	);
}

export default FilesPage;
