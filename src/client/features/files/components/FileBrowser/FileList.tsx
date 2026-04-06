/**
 * FileList - Optimized list view with gesture handling
 *
 * 职责：UI 渲染
 * - 使用 useFileItemActions 处理交互逻辑
 */
import type React from "react";
import { memo, useCallback } from "react";
import type { FileItem as FileItemType } from "@/features/files/stores/fileStore";
import { useFileItemActions } from "@/features/files/hooks";
import { FileItem } from "./FileItem";
import styles from "./FileList.module.css";

interface FileListProps {
	items: FileItemType[];
}

export const FileList = memo<FileListProps>(({ items }) => {
	// 使用业务逻辑 hook
	const {
		selectedItems,
		isMultiSelectMode,
		draggingItem,
		dropTarget,
		handleTap,
		handleDoubleTap,
		handleLongPress,
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		toggleSelection,
	} = useFileItemActions();

	// Drag handlers - bridge between DOM events and hook methods
	const onDragStart = useCallback(
		(e: React.DragEvent, item: FileItemType) => {
			handleDragStart(item);
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", item.path);
		},
		[handleDragStart],
	);

	const onDragOver = useCallback(
		(e: React.DragEvent, item: FileItemType) => {
			if (!item.isDirectory) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			handleDragOver(item);
		},
		[handleDragOver],
	);

	const onDrop = useCallback(
		async (e: React.DragEvent, targetItem: FileItemType) => {
			e.preventDefault();
			await handleDrop(targetItem);
		},
		[handleDrop],
	);

	if (items.length === 0) return null;

	return (
		<div className={styles.list}>
			<div className={styles.listHeader}>
				<span className={styles.headerCheckbox} />
				<span className={styles.headerIcon} />
				<span className={styles.headerName}>Name</span>
				<span className={styles.headerSize}>Size</span>
				<span className={styles.headerModified}>Modified</span>
			</div>
			{items.map((item) => (
				<FileItem
					key={item.path}
					item={item}
					isSelected={selectedItems.includes(item.path)}
					isMultiSelectMode={isMultiSelectMode}
					isDropTarget={dropTarget === item.path}
					isDragging={draggingItem === item.path}
					onTap={handleTap}
					onDoubleTap={handleDoubleTap}
					onLongPress={handleLongPress}
					onDragStart={onDragStart}
					onDragOver={onDragOver}
					onDragLeave={handleDragLeave}
					onDrop={onDrop}
					onDragEnd={handleDragEnd}
					onToggleSelect={toggleSelection}
					viewMode="list"
				/>
			))}
		</div>
	);
});

FileList.displayName = "FileList";
