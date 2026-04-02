/**
 * FileGrid - Enhanced grid view with multi-select, gestures, and drag-drop
 */
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { getFileIcon } from "@/services/api/fileApi";
import { type FileItem, useFileStore } from "@/stores/fileStore";
import { useFileViewerStore } from "@/stores/fileViewerStore";
import styles from "./FileGrid.module.css";

interface FileGridProps {
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

export const FileGrid = memo<FileGridProps>(({ items }) => {
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

	// Single click opens file directly, double click navigates directory
	const handleClick = useCallback(
		(item: FileItem) => {
			if (isMultiSelectMode) {
				toggleSelection(item.path);
				return;
			}

			if (item.isDirectory) {
				setCurrentPath(item.path);
			} else {
				// Single click opens file directly
				openViewer(item.path, item.name, "view");
			}
		},
		[isMultiSelectMode, toggleSelection, setCurrentPath, openViewer],
	);

	// Double click to navigate
	const handleDoubleClick = useCallback(
		(item: FileItem) => {
			if (isMultiSelectMode) return;
			if (item.isDirectory) {
				setCurrentPath(item.path);
			}
		},
		[isMultiSelectMode, setCurrentPath],
	);

	// Touch handlers for pinch-to-multi-select
	const getTouchDistance = (touches: React.TouchList): number => {
		if (touches.length < 2) return 0;
		const dx = touches[0].clientX - touches[1].clientX;
		const dy = touches[0].clientY - touches[1].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	};

	const handleTouchStart = useCallback(
		(e: React.TouchEvent, item: FileItem) => {
			const touches = e.touches;

			// Pinch detection (2 fingers)
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

			// Single touch - long press detection
			if (touches.length === 1) {
				touchState.current = {
					startX: touches[0].clientX,
					startY: touches[0].clientY,
					startTime: Date.now(),
					startDistance: null,
					isPinch: false,
					isLongPress: false,
				};

				// Start long press timer for drag
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

			// Pinch gesture detection
			if (touchState.current.isPinch && touches.length === 2) {
				const currentDistance = getTouchDistance(touches);
				const startDistance = touchState.current.startDistance;

				if (startDistance && currentDistance < startDistance * 0.7) {
					// Pinch in detected - enable multi-select
					if (!isMultiSelectMode) {
						setMultiSelectMode(true);
					}
				}
			}

			// Cancel long press if moved too much
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

			// If it was a long press, we're in drag mode
			if (touchState.current.isLongPress) {
				touchState.current = null;
				return;
			}

			// Normal tap
			if (duration < 300 && !touchState.current.isPinch) {
				handleClick(item);
			}

			touchState.current = null;
		},
		[handleClick],
	);

	// Drag and drop handlers
	const handleDragStart = useCallback(
		(e: React.DragEvent, item: FileItem) => {
			setDraggedItem(item);
			setIsDragging(true);
			setDraggingItem(item.path);

			// If not in multi-select mode, select this item
			if (!isMultiSelectMode && selectedItems.length === 0) {
				selectForAction(item.path, item.name);
			}

			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", item.path);
		},
		[
			isMultiSelectMode,
			selectedItems.length,
			setDraggedItem,
			setIsDragging,
			selectForAction,
		],
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent, item: FileItem) => {
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
		async (e: React.DragEvent, targetItem: FileItem) => {
			e.preventDefault();
			setDropTarget(null);
			setIsDragging(false);
			setDraggingItem(null);

			if (!targetItem.isDirectory) return;

			const draggedPath = e.dataTransfer.getData("text/plain");
			if (draggedPath === targetItem.path) return;

			// Move items
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

	// Cleanup
	useEffect(() => {
		return () => {
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
			}
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className={styles.grid}
			onTouchMove={handleTouchMove}
		>
			{items.map((item) => {
				const isSelected = selectedItems.includes(item.path);
				const icon = getFileIcon(item.extension, item.isDirectory);
				const isDropTarget = dropTarget === item.path;
				const isDragging = draggingItem === item.path;

				return (
					<div
						key={item.path}
						className={`${styles.gridItem} ${
							item.isDirectory ? styles.directory : ""
						} ${isSelected ? styles.selected : ""} ${
							isDropTarget ? styles.dropTarget : ""
						} ${isDragging ? styles.dragging : ""}`}
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
						title={item.name}
					>
						{isMultiSelectMode && (
							<div className={styles.checkbox}>
								{isSelected ? "☑" : "☐"}
							</div>
						)}
						<span className={styles.gridIcon}>{icon}</span>
						<span className={styles.gridName}>{item.name}</span>
					</div>
				);
			})}
		</div>
	);
});

FileGrid.displayName = "FileGrid";
