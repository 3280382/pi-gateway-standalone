/**
 * FileList - Enhanced list view with multi-select, gestures, and drag-drop
 */
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { formatFileSize, getFileIcon } from "@/services/api/fileApi";
import { type FileItem, useFileStore } from "@/stores/fileStore";
import { useFileViewerStore } from "@/stores/fileViewerStore";
import styles from "./FileList.module.css";

interface FileListProps {
	items: FileItem[];
}

interface TouchState {
	startX: number;
	startY: number;
	startTime: number;
	startDistance: number | null;
	isPinch: boolean;
	isLongPress: boolean;
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
	const containerRef = useRef<HTMLDivElement>(null);
	const touchState = useRef<TouchState | null>(null);
	const longPressTimer = useRef<NodeJS.Timeout | null>(null);
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const [draggingItem, setDraggingItem] = useState<string | null>(null);

	// Single click opens file directly
	const handleClick = useCallback(
		(item: FileItem) => {
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

	// Double click for navigation
	const handleDoubleClick = useCallback(
		(item: FileItem) => {
			if (isMultiSelectMode) return;
			if (item.isDirectory) {
				setCurrentPath(item.path);
			}
		},
		[isMultiSelectMode, setCurrentPath],
	);

	// Touch handlers
	const getTouchDistance = (touches: React.TouchList): number => {
		if (touches.length < 2) return 0;
		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	};

	const handleTouchStart = useCallback(
		(e: React.TouchEvent, item: FileItem) => {
			const touches = e.touches;

			if (touches.length === 2) {
				touchState.current = {
					startX: (touches[0].clientX + touches[1].clientX) / 2,
					startY: (touches[0].clientY + touches[1].clientY) / 2,
					startTime: Date.now(),
					startDistance: getTouchDistance(touches),
					isPinch: true,
					isLongPress: false,
				};
				return;
			}

			if (touches.length === 1) {
				touchState.current = {
					startX: touches[0].clientX,
					startY: touches[0].clientY,
					startTime: Date.now(),
					startDistance: null,
					isPinch: false,
					isLongPress: false,
				};

				longPressTimer.current = setTimeout(() => {
					touchState.current!.isLongPress = true;
					setDraggedItem(item);
					setIsDragging(true);
					setDraggingItem(item.path);
				}, 500);
			}
		},
		[setDraggedItem, setIsDragging],
	);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!touchState.current) return;

			const touches = e.touches;

			if (touchState.current.isPinch && touches.length === 2) {
				const currentDistance = getTouchDistance(touches);
				const startDistance = touchState.current.startDistance;

				if (startDistance && currentDistance < startDistance * 0.7) {
					if (!isMultiSelectMode) {
						setMultiSelectMode(true);
					}
				}
			}

			if (touches.length === 1 && longPressTimer.current) {
				const dx = touches[0].clientX - touchState.current.startX;
				const dy = touches[0].clientY - touchState.current.startY;
				if (Math.sqrt(dx * dx + dy * dy) > 10) {
					clearTimeout(longPressTimer.current);
					longPressTimer.current = null;
				}
			}
		},
		[isMultiSelectMode, setMultiSelectMode],
	);

	const handleTouchEnd = useCallback(
		(e: React.TouchEvent, item: FileItem) => {
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
				longPressTimer.current = null;
			}

			if (!touchState.current) return;

			const duration = Date.now() - touchState.current.startTime;

			if (touchState.current.isLongPress) {
				touchState.current = null;
				return;
			}

			if (duration < 300 && !touchState.current.isPinch) {
				handleClick(item);
			}

			touchState.current = null;
		},
		[handleClick],
	);

	// Drag and drop
	const handleDragStart = useCallback(
		(e: React.DragEvent, item: FileItem) => {
			setDraggedItem(item);
			setIsDragging(true);
			setDraggingItem(item.path);

			if (!isMultiSelectMode && selectedItems.length === 0) {
				selectForAction(item.path, item.name);
			}

			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", item.path);
		},
		[setDraggedItem, setIsDragging, isMultiSelectMode, selectedItems.length, selectForAction],
	);

	const handleDragOver = useCallback((e: React.DragEvent, item: FileItem) => {
		if (!item.isDirectory) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDropTarget(item.path);
	}, []);

	const handleDragLeave = useCallback(() => {
		setDropTarget(null);
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent, targetItem: FileItem) => {
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

	const formatDate = (dateString: string) => {
		if (!dateString) return "";
		try {
			return new Date(dateString).toLocaleDateString();
		} catch {
			return dateString;
		}
	};

	useEffect(() => {
		return () => {
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
			}
		};
	}, []);

	if (items.length === 0) return null;

	return (
		<div
			ref={containerRef}
			className={styles.list}
			onTouchMove={handleTouchMove}
		>
			<div className={styles.listHeader}>
				<span className={styles.headerName}>Name</span>
				<span className={styles.headerSize}>Size</span>
				<span className={styles.headerModified}>Modified</span>
			</div>
			{items.map((item) => {
				const isSelected = selectedItems.includes(item.path);
				const icon = getFileIcon(item.extension, item.isDirectory);
				const isDropTarget = dropTarget === item.path;
				const isDragging = draggingItem === item.path;

				return (
					<div
						key={item.path}
						className={`${styles.listItem} ${isSelected ? styles.selected : ""} ${
							item.isDirectory ? styles.directory : ""
						} ${isDropTarget ? styles.dropTarget : ""} ${
							isDragging ? styles.dragging : ""
						}`}
						onClick={() => handleClick(item)}
						onDoubleClick={() => handleDoubleClick(item)}
						onTouchStart={(e) => handleTouchStart(e, item)}
						onTouchEnd={(e) => handleTouchEnd(e, item)}
						draggable={!item.isDirectory || isMultiSelectMode}
						onDragStart={(e) => handleDragStart(e, item)}
						onDragOver={(e) => handleDragOver(e, item)}
						onDragLeave={handleDragLeave}
						onDrop={(e) => handleDrop(e, item)}
						onDragEnd={handleDragEnd}
					>
						{isMultiSelectMode && (
							<div className={styles.checkbox}>
								{isSelected ? "☑" : "☐"}
							</div>
						)}
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
