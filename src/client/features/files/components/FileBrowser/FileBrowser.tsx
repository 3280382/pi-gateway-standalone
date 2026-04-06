/**
 * FileBrowser - 文件浏览器主组件
 *
 * 职责：UI 渲染
 * - 不包含业务逻辑
 * - 通过 hooks 获取数据和操作
 */

import React from "react";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import {
	useFileBrowser,
	useFileFiltering,
} from "@/features/files/hooks";
import { fileBrowserDebug } from "@/lib/debug";

import { FileActionBar } from "../Header/FileActionBar";
import styles from "./FileBrowser.module.css";
import { FileBrowserErrorBoundary } from "./FileBrowserErrorBoundary";
import { FileGrid } from "./FileGrid";
import { FileList } from "./FileList";
import { FileViewer } from "../Viewer/FileViewer";

interface FileBrowserProps {
	externalSidebarVisible?: boolean;
	onToggleSidebar?: () => void;
	onExecuteOutput?: (output: string) => void;
	onOpenBottomPanel?: (output: string) => void;
}

export function FileBrowser({
	externalSidebarVisible,
	onToggleSidebar,
	onExecuteOutput,
	onOpenBottomPanel,
}: FileBrowserProps) {
	// 获取状态
	const {
		currentPath,
		viewMode,
		isLoading,
		error,
		sidebarVisible: storeSidebarVisible,
		items,
	} = useFileStore();

	const fileViewerStore = useFileViewerStore();

	// 使用业务逻辑 hooks
	const { loadDirectory, refresh } = useFileBrowser();
	const { filteredItems } = useFileFiltering();

	// 使用外部或内部侧边栏状态
	const sidebarVisible =
		externalSidebarVisible !== undefined
			? externalSidebarVisible
			: storeSidebarVisible;

	// 调试日志
	fileBrowserDebug.info("FileBrowser 渲染", {
		currentPath,
		isLoading,
		error,
		itemsCount: items.length,
		filteredItemsCount: filteredItems.length,
	});

	return (
		<section className={styles.fileBrowserSection}>
			<div className={styles.container}>
				{/* 主内容区 */}
				<div className={styles.main}>
					{/* 选中文件操作栏 */}
					<FileBrowserErrorBoundary componentName="File Action Bar">
						<FileActionBar
							onExecute={onExecuteOutput}
							onOpenBottomPanel={onOpenBottomPanel}
						/>
					</FileBrowserErrorBoundary>

					{/* 文件列表区域 */}
					<div className={styles.contentArea}>
						{isLoading ? (
							<div className={styles.loading}>Loading...</div>
						) : error ? (
							<div className={styles.error}>{error}</div>
						) : filteredItems.length === 0 ? (
							<div className={styles.empty}>No files found</div>
						) : viewMode === "grid" ? (
							<FileBrowserErrorBoundary componentName="File Grid">
								<FileGrid items={filteredItems} />
							</FileBrowserErrorBoundary>
						) : (
							<FileBrowserErrorBoundary componentName="File List">
								<FileList items={filteredItems} />
							</FileBrowserErrorBoundary>
						)}
					</div>
				</div>
			</div>

			{/* 文件查看器模态框 */}
			<FileBrowserErrorBoundary componentName="File Viewer">
				<FileViewer />
			</FileBrowserErrorBoundary>
		</section>
	);
}
