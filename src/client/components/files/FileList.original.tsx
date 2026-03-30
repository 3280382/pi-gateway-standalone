/**
 * FileList - 列表视图 (无复选框，点击选中/进入)
 */
import React, { memo, useRef } from "react";
import { formatFileSize, getFileIcon } from "@/services/api/fileApi";
import { type FileItem, useFileStore } from "@/stores/fileStore";
import { useFileViewerStore } from "@/stores/fileViewerStore";
import styles from "./FileBrowser.module.css";

interface FileListProps {
	items: FileItem[];
}
export const FileList = memo<FileListProps>(({ items }) => {
	const {
		selectedFile, // 修改：使用selectedFile而不是selectedItems
		clearSelection,
		selectForAction,
		setCurrentPath,
		selectedActionFile,
	} = useFileStore();

	const { openViewer } = useFileViewerStore();
	const clickTimers = useRef<Record<string, NodeJS.Timeout>>({});
	const handleClick = (item: FileItem) => {
		// 清除该项目的现有计时器
		if (clickTimers.current[item.path]) {
			clearTimeout(clickTimers.current[item.path]);
			delete clickTimers.current[item.path];
		}
		if (item.isDirectory) {
			// 点击文件夹直接进入
			setCurrentPath(item.path);
		} else {
			// 检查是否是再次单击（已选中状态）
			if (selectedActionFile === item.path) {
				// 再次单击：打开主导排查
				openViewer(item.path, item.name, "view");
			} else {
				// 首次单击：选中文件
				clearSelection();
				selectForAction(item.path, item.name);
			}
		}
	};
	const handleDoubleClick = (item: FileItem) => {
		// 清除单击计时器
		if (clickTimers.current[item.path]) {
			clearTimeout(clickTimers.current[item.path]);
			delete clickTimers.current[item.path];
		}
		if (item.isDirectory) {
			// 双击文件夹进入
			setCurrentPath(item.path);
		} else {
			// 双击文件：直接打开主导排查
			clearSelection();
			selectForAction(item.path, item.name);
			openViewer(item.path, item.name, "view");
		}
	};
	return (
		<div className={styles.list}>
			<div className={styles.listHeader}>
				<span className={styles.headerName}>Name</span>
				<span className={styles.headerSize}>Size</span>
				<span className={styles.headerModified}>Modified</span>
			</div>
			{items.map((item) => {
				const isSelected = selectedFile === item.path;
				const icon = getFileIcon(item.extension, item.isDirectory);
				return (
					<div
						key={item.path}
						className={`${styles.listItem} ${isSelected ? styles.selected : ""} ${item.isDirectory ? styles.directory : ""}`}
						onClick={() => handleClick(item)}
						onDoubleClick={() => handleDoubleClick(item)}
					>
						<span className={styles.listIcon}>{icon}</span>
						<span className={styles.listName}>{item.name}</span>
						<span className={styles.listSize}>{formatFileSize(item.size)}</span>
						<span className={styles.listModified}>
							{item.modified
								? new Date(item.modified).toLocaleDateString()
								: "-"}
						</span>
					</div>
				);
			})}
		</div>
	);
});
FileList.displayName = "FileList";
