/**
 * FileGrid - Optimized grid view with gesture handling
 */
import React, { memo, useCallback, useRef, useState } from "react";
import type { FileItem as FileItemType } from "@/stores/fileStore";
import { useFileStore } from "@/stores/fileStore";
import { useFileViewerStore } from "@/stores/fileViewerStore";
import { FileItem } from "../FileItem";
import styles from "./FileGrid.module.css";

interface FileGridProps {
	items: FileItemType[];
}

interface PinchState {
	startDistance: number;
	isPinching: boolean;
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
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const [draggingItem, setDraggingItem] = useState<string | null>(null);
	const [showPinchHint, setShowPinchHint] = useState(false);
	
	const containerRef = useRef<HTMLDivElement>(null);
	const pinchState = useRef<PinchState | null>(null);
	const pinchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Handle tap (single click)
	const handleTap = useCallback(
		(item: FileItemType) => {
			if (isMultiSelectMode) {
				toggleSelection(item.path);
				return;
			}

			if (item.isDirectory) {
				setCurrentPath(item.path);
			} else {
				// Single tap opens file directly
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
			// Enable multi-select mode on long press
			if (!isMultiSelectMode) {
				setMultiSelectMode(true);
			}
			toggleSelection(item.path);
			
			// Setup drag
			setDraggedItem(item);
			setIsDragging(true);
			setDraggingItem(item.path);
		},
		[isMultiSelectMode, setMultiSelectMode, toggleSelection, setDraggedItem, setIsDragging],
	);

	// Handle pinch gesture
	const handlePinchStart = useCallback(() => {
		pinchState.current = {
			startDistance: 0,
			isPinching: true,
		};
	}, []);

	const handlePinch = useCallback(
		(scale: number) => {
			if (!pinchState.current?.isPinching) return;

			// Pinch in (scale < 0.7) triggers multi-select
			if (scale < 0.7 && !isMultiSelectMode) {
				setMultiSelectMode(true);
				setShowPinchHint(true);
				
				if (pinchTimeoutRef.current) {
					clearTimeout(pinchTimeoutRef.current);
				}
				pinchTimeoutRef.current = setTimeout(() => {
					setShowPinchHint(false);
				}, 2000);
			}
		},
		[isMultiSelectMode, setMultiSelectMode],
	);

	// Touch handlers for container-level pinch detection
	const handleContainerTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (e.touches.length === 2) {
				const t1 = e.touches[0];
				const t2 = e.touches[1];
				const distance = Math.sqrt(
					Math.pow(t2.clientX - t1.clientX, 2) +
						Math.pow(t2.clientY - t1.clientY, 2),
				);
				pinchState.current = {
					startDistance: distance,
					isPinching: true,
				};
			}
		},
		[],
	);

	const handleContainerTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!pinchState.current?.isPinching || e.touches.length !== 2) return;

			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const currentDistance = Math.sqrt(
				Math.pow(t2.clientX - t1.clientX, 2) +
					Math.pow(t2.clientY - t1.clientY, 2),
			);

			const scale = currentDistance / pinchState.current.startDistance;
			handlePinch(scale);
		},
		[handlePinch],
	);

	const handleContainerTouchEnd = useCallback(() => {
		pinchState.current = null;
	}, []);

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
		[setDraggedItem, setIsDragging, isMultiSelectMode, selectedItems.length, selectForAction],
	);

	const handleDragOver = useCallback((e: React.DragEvent, item: FileItemType) => {
		if (!item.isDirectory) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDropTarget(item.path);
	}, []);

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

	return (
		<>
			<div
				ref={containerRef}
				className={styles.grid}
				onTouchStart={handleContainerTouchStart}
				onTouchMove={handleContainerTouchMove}
				onTouchEnd={handleContainerTouchEnd}
			>
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
						viewMode="grid"
					/>
				))}
			</div>

			{/* Pinch hint */}
			{showPinchHint && (
				<div className={styles.pinchHint}>
					Multi-select mode enabled
				</div>
			)}
		</>
	);
});

FileGrid.displayName = "FileGrid";
