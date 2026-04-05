/**
 * FileList - Optimized list view with gesture handling
 */
import type React from "react";
import { memo, useCallback, useState } from "react";
import type { FileItem as FileItemType } from "@/features/files/stores/fileStore";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { FileItem } from "./FileItem";
import styles from "./FileList.module.css";

interface FileListProps {
	items: FileItemType[];
}

export const FileList = memo<FileListProps>(({ items }) => {
	const {
		selectedItems,
		isMultiSelectMode,
		setCurrentPath,
		selectForAction,
		toggleSelection,
		setMultiSelectMode,
		setDraggedItem,
		setIsDragging,
		moveSelectedItems,
	} = useFileStore();

	const { openViewer } = useFileViewerStore();
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const [draggingItem, setDraggingItem] = useState<string | null>(null);

	// Handle tap
	const handleTap = useCallback(
		(item: FileItemType) => {
			if (isMultiSelectMode) {
				toggleSelection(item.path);
				return;
			}

			if (item.isDirectory) {
				setCurrentPath(item.path);
			} else {
				openViewer(item.path, item.name, "view");
			}
		},
		[isMultiSelectMode, toggleSelection, setCurrentPath, openViewer],
	);

	// Handle double tap
	const handleDoubleTap = useCallback(
		(item: FileItemType) => {
			if (isMultiSelectMode) return;
			if (item.isDirectory) {
				setCurrentPath(item.path);
			}
		},
		[isMultiSelectMode, setCurrentPath],
	);

	// Handle long press
	const handleLongPress = useCallback(
		(item: FileItemType) => {
			if (!isMultiSelectMode) {
				setMultiSelectMode(true);
			}
			toggleSelection(item.path);
			setDraggedItem(item);
			setIsDragging(true);
			setDraggingItem(item.path);
		},
		[
			isMultiSelectMode,
			setMultiSelectMode,
			toggleSelection,
			setDraggedItem,
			setIsDragging,
		],
	);

	// Drag and drop handlers
	const handleDragStart = useCallback(
		(e: React.DragEvent, item: FileItemType) => {
			setDraggedItem(item);
			setIsDragging(true);
			setDraggingItem(item.path);

			if (!isMultiSelectMode && selectedItems.length === 0) {
				selectForAction(item.path, item.name);
			}

			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", item.path);
		},
		[
			setDraggedItem,
			setIsDragging,
			isMultiSelectMode,
			selectedItems.length,
			selectForAction,
		],
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent, item: FileItemType) => {
			if (!item.isDirectory) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			setDropTarget(item.path);
		},
		[],
	);

	const handleDragLeave = useCallback(() => {
		setDropTarget(null);
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent, targetItem: FileItemType) => {
			e.preventDefault();
			setDropTarget(null);
			setIsDragging(false);
			setDraggingItem(null);

			if (!targetItem.isDirectory) return;

			const draggedPath = e.dataTransfer.getData("text/plain");
			if (draggedPath === targetItem.path) return;

			try {
				await moveSelectedItems(targetItem.path);
			} catch (error) {
				console.error("Move failed:", error);
			}
		},
		[moveSelectedItems, setIsDragging],
	);

	const handleDragEnd = useCallback(() => {
		setDraggedItem(null);
		setIsDragging(false);
		setDraggingItem(null);
		setDropTarget(null);
	}, [setDraggedItem, setIsDragging]);

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
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					onDragEnd={handleDragEnd}
					onToggleSelect={toggleSelection}
					viewMode="list"
				/>
			))}
		</div>
	);
});

FileList.displayName = "FileList";
