/**
 * FileList - List view for file browser
 *
 * 职责：纯 UI 渲染
 * - 无业务逻辑
 * - 通过 useFileItemActions 获取所有交互处理器
 */

import type React from "react";
import { memo } from "react";
import { useFileItemActions } from "@/features/files/hooks";
import type { FileItem as FileItemType } from "@/features/files/stores/fileStore";
import { FileItem } from "./FileItem";
import styles from "./FileList.module.css";

interface FileListProps {
	items: FileItemType[];
}

export const FileList = memo<FileListProps>(({ items }) => {
	const {
		selectedItems,
		isMultiSelectMode,
		draggingItem,
		dropTarget,
		getItemHandlers,
	} = useFileItemActions();

	if (items.length === 0) return null;

	return (
		<div className={styles.list}>
			<div className={styles.listHeader}>
              {isMultiSelectMode && (<span className={styles.headerCheckbox} />)}
				<span className={styles.headerIcon}>Icon</span>
				<span className={styles.headerName}>Name</span>
				<span className={styles.headerSize}>Size</span>
				<span className={styles.headerModified}>Modified</span>
			</div>
			{items.map((item) => {
				const handlers = getItemHandlers(item);
				return (
					<FileItem
						key={item.path}
						item={item}
						isSelected={selectedItems.includes(item.path)}
						isMultiSelectMode={isMultiSelectMode}
						isDropTarget={dropTarget === item.path}
						isDragging={draggingItem === item.path}
						{...handlers}
						viewMode="list"
					/>
				);
			})}
		</div>
	);
});

FileList.displayName = "FileList";
