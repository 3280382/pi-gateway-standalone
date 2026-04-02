/**
 * FileBrowser - 文件浏览器主组件 (Enhanced with multi-select, gestures, drag-drop)
 */
import React, { useCallback, useEffect, useRef } from "react";
import { fileBrowserDebug, withLogging } from "@/lib/debug";
import { browseDirectory } from "@/services/api/fileApi";
import { useFileStore } from "@/stores/fileStore";
import { useFileViewerStore } from "@/stores/fileViewerStore";
import { BatchActionBar } from "./BatchActionBar";
import { FileActionBar } from "./FileActionBar";
import styles from "./FileBrowser.module.css";
import { FileBrowserErrorBoundary } from "./FileBrowserErrorBoundary";
import { FileGrid } from "./FileGrid/FileGrid";
import { FileList } from "./FileList/FileList";
import { FileSidebar } from "./FileSidebar";
import { FileViewer } from "./FileViewer";

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
	const {
		currentPath,
		viewMode,
		isLoading,
		error,
		sidebarVisible: storeSidebarVisible,
		items,
		setItems,
		setLoading,
		setError,
		setCurrentPath,
		getFilteredAndSortedItems,
	} = useFileStore();
	// 使用外部状态或内部状态
	const sidebarVisible =
		externalSidebarVisible !== undefined
			? externalSidebarVisible
			: storeSidebarVisible;
	const filteredItems = getFilteredAndSortedItems();
	// 获取文件查看器状态用于key
	const fileViewerStore = useFileViewerStore();
	// 加载目录内容（无缓存）
	const loadDirectory = useCallback(
		async (path: string) => {
			fileBrowserDebug.info("开始加载目录", { path });
			setLoading(true);
			setError(null);
			try {
				fileBrowserDebug.debug("调用browseDirectory API", { path });
				const data = await browseDirectory(path);
				fileBrowserDebug.info("目录加载成功", {
					currentPath: data.currentPath,
					itemCount: data.items.length,
					hasParent: data.parentPath !== data.currentPath,
				});

				const itemsToSet = [
					// 上级目录
					...(data.parentPath !== data.currentPath
						? [
								{
									name: "..",
									path: data.parentPath,
									isDirectory: true,
									modified: "",
								},
							]
						: []),
					...data.items,
				];

				fileBrowserDebug.debug("设置文件项", { itemCount: itemsToSet.length });
				setItems(itemsToSet);
				setCurrentPath(data.currentPath);

				fileBrowserDebug.info("目录加载完成", {
					currentPath: data.currentPath,
					totalItems: itemsToSet.length,
				});
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to load directory";
				fileBrowserDebug.error("目录加载失败", {
					path,
					error: errorMessage,
					errorObject: err,
				});

				setError(errorMessage);

				// 提供更友好的错误消息
				if (
					errorMessage.includes("permission") ||
					errorMessage.includes("Permission")
				) {
					const friendlyError = `Permission denied: Cannot access "${path}". You may need to check file permissions.`;
					fileBrowserDebug.warn("权限错误", {
						path,
						originalError: errorMessage,
						friendlyError,
					});
					setError(friendlyError);
				}
				// 如果是路径不存在错误
				else if (
					errorMessage.includes("ENOENT") ||
					errorMessage.includes("not exist")
				) {
					const friendlyError = `Directory not found: "${path}" does not exist or cannot be accessed.`;
					fileBrowserDebug.warn("路径不存在错误", {
						path,
						originalError: errorMessage,
						friendlyError,
					});
					setError(friendlyError);
				}
				// 如果是网络错误
				else if (
					errorMessage.includes("network") ||
					errorMessage.includes("Network")
				) {
					const friendlyError = `Network error: Cannot connect to server. Please check your connection.`;
					fileBrowserDebug.warn("网络错误", {
						path,
						originalError: errorMessage,
						friendlyError,
					});
					setError(friendlyError);
				} else {
					fileBrowserDebug.warn("其他错误", { path, error: errorMessage });
				}
			} finally {
				fileBrowserDebug.debug("设置加载状态为false");
				setLoading(false);
			}
		},
		[setItems, setLoading, setError, setCurrentPath],
	);
	// 路径变化时加载新目录
	const lastLoadedPathRef = useRef<string>("");
	useEffect(() => {
		// 避免重复加载相同路径
		if (currentPath === lastLoadedPathRef.current) {
			return;
		}
		lastLoadedPathRef.current = currentPath;
		
		fileBrowserDebug.info("FileBrowser组件挂载/更新", {
			currentPath,
			isLoading,
			error,
			itemsCount: items.length,
			filteredItemsCount: filteredItems.length,
		});

		// 路径变化时加载新目录（每次都从服务器获取）
		loadDirectory(currentPath);
	}, [currentPath, loadDirectory]);
	// 监听状态变化
	useEffect(() => {
		if (error) {
			fileBrowserDebug.warn("文件浏览器错误状态", { error });
		}
	}, [error]);
	useEffect(() => {
		if (isLoading) {
			fileBrowserDebug.debug("文件浏览器加载中", { currentPath });
		}
	}, [isLoading]);
	return (
		<section className={styles.fileBrowserSection}>
			<div className={styles.container}>
				{/* 侧边栏文件树 */}
				<FileBrowserErrorBoundary componentName="File Sidebar">
					<FileSidebar visible={sidebarVisible} />
				</FileBrowserErrorBoundary>
				{/* 主内容区 */}
				<div className={styles.main}>
					{/* 批量操作栏 - 多选模式 */}
					<FileBrowserErrorBoundary componentName="Batch Action Bar">
						<BatchActionBar />
					</FileBrowserErrorBoundary>

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
