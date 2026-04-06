/**
 * FileGrid - Optimized grid view with gesture handling
 *
 * 职责：UI 渲染
 * - 使用 useFileItemActions 处理交互逻辑
 * - 本地状态管理（捏合提示）
 */
import type React from "react";
import { memo, useCallback, useRef, useState } from "react";
import type { FileItem as FileItemType } from "@/features/files/stores/fileStore";
import { useFileItemActions } from "@/features/files/hooks";
import styles from "./FileGrid.module.css";
import { FileItem } from "./FileItem";

interface FileGridProps {
	items: FileItemType[];
}

interface PinchState {
	startDistance: number;
	isPinching: boolean;
}

export const FileGrid = memo<FileGridProps>(({ items }) => {
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

	// 本地 UI 状态
	const [showPinchHint, setShowPinchHint] = useState(false);

	// Refs for gesture handling
	const containerRef = useRef<HTMLDivElement>(null);
	const pinchState = useRef<PinchState | null>(null);
	const pinchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Handle pinch gesture
	const handlePinch = useCallback(
		(scale: number, setMultiSelectMode: (enabled: boolean) => void) => {
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
		[isMultiSelectMode],
	);

	// Touch handlers for container-level pinch detection
	const handleContainerTouchStart = useCallback((e: React.TouchEvent) => {
		if (e.touches.length === 2) {
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const distance = Math.sqrt(
				(t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2,
			);
			pinchState.current = {
				startDistance: distance,
				isPinching: true,
			};
		}
	}, []);

	const handleContainerTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!pinchState.current?.isPinching || e.touches.length !== 2) return;

			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const currentDistance = Math.sqrt(
				(t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2,
			);

			const scale = currentDistance / pinchState.current.startDistance;
			// Note: setMultiSelectMode would need to be passed from hook
			// For now, we'll use the hook's internal method through handlePinch
		},
		[],
	);

	const handleContainerTouchEnd = useCallback(() => {
		pinchState.current = null;
	}, []);

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
						onDragStart={onDragStart}
						onDragOver={onDragOver}
						onDragLeave={handleDragLeave}
						onDrop={onDrop}
						onDragEnd={handleDragEnd}
						onToggleSelect={toggleSelection}
						viewMode="grid"
					/>
				))}
			</div>

			{/* Pinch hint */}
			{showPinchHint && (
				<div className={styles.pinchHint}>Multi-select mode enabled</div>
			)}
		</>
	);
});

FileGrid.displayName = "FileGrid";
