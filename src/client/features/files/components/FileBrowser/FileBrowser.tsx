/**
 * FileBrowser - 文件浏览器主组件
 *
 * 职责：UI 渲染
 * - 不包含业务逻辑
 * - 通过 hooks 获取数据和操作
 */

import React from "react";
import styles from "@/features/files/components/FileBrowser/FileBrowser.module.css";
import { FileBrowserErrorBoundary } from "@/features/files/components/FileBrowser/FileBrowserErrorBoundary";
import { FileGrid } from "@/features/files/components/FileBrowser/FileGrid";
import { FileList } from "@/features/files/components/FileBrowser/FileList";

import { FileActionBar } from "@/features/files/components/Header/FileActionBar";
import { FileViewer } from "@/features/files/components/Viewer/FileViewer";
import { useFileBrowser, useFileFiltering } from "@/features/files/hooks";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { fileBrowserDebug } from "@/lib/debug";

interface FileBrowserProps {
	onExecuteOutput?: (output: string) => void;
	onOpenBottomPanel?: (output: string) => void;
}

export function FileBrowser({
	onExecuteOutput,
	onOpenBottomPanel,
}: FileBrowserProps) {
	// ========== 1. State ==========
	const { viewMode, isLoading, error, items } = useFileStore();
	const fileViewerStore = useFileViewerStore();

	// ========== 2. Ref ==========
	// 无直接DOM引用

	// ========== 3. Effects ==========
	// 使用useFileBrowser hook管理副作用
	const { refresh } = useFileBrowser();

	// ========== 4. Computed ==========
	const { filteredItems } = useFileFiltering();

	// 调试日志
	fileBrowserDebug.debug("FileBrowser 渲染", {
		isLoading,
		error,
		itemsCount: items.length,
		filteredItemsCount: filteredItems.length,
	});

	// ========== 5. Actions ==========
	// 通过hooks获取

	// ========== 6. Render ==========
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
