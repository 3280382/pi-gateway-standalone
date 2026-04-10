/**
 * FilesPage - 文件页面
 *
 * 职责：文件功能完整布局
 * - 包含 FileToolbar、FileSidebar、FileBrowser、Panel、BottomMenu
 * - 所有状态通过 Hooks 内部获取
 * - 实现 KeepAlive：首次激活才挂载，之后通过 display 控制显示隐藏
 */

import { FileBottomMenu } from "@/features/files/components/BottomMenu/FileBottomMenu";
import { FileBrowser } from "@/features/files/components/FileBrowser/FileBrowser";
import { FileToolbar } from "@/features/files/components/Header/FileToolbar";
import { TerminalPanel } from "@/features/files/components/panels/TerminalPanel";
import { FileSidebar } from "@/features/files/components/Sidebar/FileSidebar";
import styles from "@/features/files/FilesLayout.module.css";
import { useFileBrowser, useFileNavigation } from "@/features/files/hooks";
import { useFileStore, useViewerStore } from "@/features/files/stores";

export function FilesPage() {
	// ========== 1. State ==========
	// 从store获取布局状态
	const {
		workingDir,
		isSidebarVisible,
		isBottomPanelOpen,
		bottomPanelHeight,
		closeBottomPanel,
		setBottomPanelHeight,
	} = useFileStore();

	// 从viewer store获取终端状态
	const { terminalOutput, terminalCommand, setTerminalCommand } = useViewerStore();

	// ========== 2. Ref ==========
	// 不再需要hasMountedRef

	// ========== 3. Effects ==========
	// 使用useFileBrowser hook管理初始化和副作用
	const { refresh } = useFileBrowser();

	// ========== 4. Computed ==========
	// 从导航hook获取
	const { navigateTo } = useFileNavigation();

	// ========== 5. Actions ==========
	// 通过hooks获取

	// ========== 6. Render ==========
	return (
		<div className={styles.layout}>
			{/* FileToolbar - 文件浏览器专用顶部工具栏 */}
			<header className={styles.header}>
				<FileToolbar
					workingDir={workingDir}
					onRefresh={refresh}
					onNavigate={navigateTo}
				/>
			</header>

			{/* Body: FileSidebar + Content */}
			<div className={styles.body}>
				{/* FileSidebar - 条件渲染，避免隐藏时加载资源 */}
				{isSidebarVisible && (
					<FileSidebar visible={true} onNavigate={navigateTo} />
				)}

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
