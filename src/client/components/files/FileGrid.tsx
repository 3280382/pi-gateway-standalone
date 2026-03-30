/**
 * FileGrid - 网格视图 (无复选框，点击选中/进入)
 */
import React, { memo, useRef } from "react";
import { getFileIcon } from "@/services/api/fileApi";
import { type FileItem, useFileStore } from "@/stores/fileStore";
import { useFileViewerStore } from "@/stores/fileViewerStore";
import styles from "./FileBrowser.module.css";

interface FileGridProps {
	items: FileItem[];
}
export const FileGrid = memo<FileGridProps>(({ items }) => {
	const {
		selectedItems,
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
		<div className={styles.grid}>
			{items.map((item) => {
				const isSelected = selectedItems.includes(item.path);
				const icon = getFileIcon(item.extension, item.isDirectory);
				return (
					<div
						key={item.path}
						className={`${styles.gridItem} ${item.isDirectory ? styles.directory : ""} ${isSelected ? styles.selected : ""}`}
						onClick={() => handleClick(item)}
						onDoubleClick={() => handleDoubleClick(item)}
						title={item.name}
					>
						<span className={styles.gridIcon}>{icon}</span>
						<span className={styles.gridName}>{item.name}</span>
					</div>
				);
			})}
		</div>
	);
});
FileGrid.displayName = "FileGrid";
