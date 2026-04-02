/**
 * FileList - 列表视图 (带调试日志)
 */
import React, { memo, useRef } from "react";
import { fileListDebug, withLogging } from "@/lib/debug";
import { formatFileSize, getFileIcon } from "@/services/api/fileApi";
import { type FileItem, useFileStore } from "@/stores/fileStore";
import { useFileViewerStore } from "@/stores/fileViewerStore";
import styles from "./FileBrowser.module.css";

interface FileListProps {
	items: FileItem[];
}
export const FileList = memo<FileListProps>(({ items }) => {
	fileListDebug.info("FileList组件渲染", { itemCount: items.length });

	const {
		selectedActionFile,
		selectedActionFileName,
		clearSelection,
		selectForAction,
		setCurrentPath,
	} = useFileStore();

	const { openViewer } = useFileViewerStore();
	const handleClick = withLogging(
		fileListDebug,
		"handleClick",
		(item: FileItem) => {
			fileListDebug.debug("文件单击处理", {
				path: item.path,
				name: item.name,
				isDirectory: item.isDirectory,
			});

			if (item.isDirectory) {
				// 目录：导航
				fileListDebug.info("导航到目录", { path: item.path, name: item.name });
				setCurrentPath(item.path);
			} else {
				// 文件：选择
				fileListDebug.debug("选择文件", { path: item.path, name: item.name });
				selectForAction(item.path, item.name);
			}
		},
	);

	const handleDoubleClick = withLogging(
		fileListDebug,
		"handleDoubleClick",
		(item: FileItem) => {
			fileListDebug.debug("文件双击处理", {
				path: item.path,
				name: item.name,
				isDirectory: item.isDirectory,
			});

			if (!item.isDirectory) {
				// 文件：打开查看器
				fileListDebug.info("打开文件查看器", {
					path: item.path,
					name: item.name,
				});
				openViewer(item.path, item.name, "view");
			}
		},
	);
	const formatDate = (dateString: string) => {
		if (!dateString) return "";
		try {
			return new Date(dateString).toLocaleDateString();
		} catch {
			return dateString;
		}
	};
	if (items.length === 0) {
		fileListDebug.debug("文件列表为空");
		return null;
	}
	fileListDebug.debug("渲染文件列表", { itemCount: items.length });

	return (
		<div className={styles.list} data-testid="file-list-container">
			<div className={styles.listHeader}>
				<span className={styles.headerName}>Name</span>
				<span className={styles.headerSize}>Size</span>
				<span className={styles.headerModified}>Modified</span>
			</div>
			{items.map((item) => {
				const isSelected = selectedActionFile === item.path;
				const icon = getFileIcon(item.extension, item.isDirectory);
				if (isSelected) {
					fileListDebug.verbose("渲染选中文件", {
						name: item.name,
						path: item.path,
					});
				}
				return (
					<div
						key={item.path}
						className={`${styles.listItem} ${isSelected ? styles.selected : ""} ${item.isDirectory ? styles.directory : ""}`}
						onClick={() => handleClick(item)}
						onDoubleClick={() => handleDoubleClick(item)}
					>
						<div className={styles.listIcon}>{icon}</div>
						<div className={styles.listName}>{item.name}</div>
						<div className={styles.listSize}>
							{item.isDirectory ? "" : formatFileSize(item.size)}
						</div>
						<div className={styles.listModified}>
							{formatDate(item.modified)}
						</div>
					</div>
				);
			})}
		</div>
	);
});
FileList.displayName = "FileList";
