/**
 * useFileItemActions - 文件项操作逻辑 Hook
 *
 * 职责：管理文件项的交互操作（点击、选择、拖拽、手势等）
 * - 所有交互逻辑封装在此
 * - 组件只负责渲染和绑定事件处理器
 */

import { useCallback, useRef, useState } from "react";
import type { FileItem } from "@/features/files/stores/fileStore";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { batchMoveFiles } from "@/features/files/services/api/fileOperationsApi";

interface PinchState {
	startDistance: number;
	isPinching: boolean;
}

export interface UseFileItemActionsResult {
	// 状态
	isMultiSelectMode: boolean;
	selectedItems: string[];
	draggingItem: string | null;
	dropTarget: string | null;
	showPinchHint: boolean;

	// 文件项事件处理器（直接绑定到 FileItem）
	getItemHandlers: (item: FileItem) => {
		onTap: () => void;
		onDoubleTap: () => void;
		onLongPress: () => void;
		onDragStart: (e: React.DragEvent) => void;
		onDragOver: (e: React.DragEvent) => void;
		onDragLeave: () => void;
		onDrop: (e: React.DragEvent) => void;
		onDragEnd: () => void;
		onToggleSelect: () => void;
	};

	// 容器手势处理器（绑定到 grid/list 容器）
	getContainerHandlers: () => {
		onTouchStart: (e: React.TouchEvent) => void;
		onTouchMove: (e: React.TouchEvent) => void;
		onTouchEnd: () => void;
	};

	// 选择操作
	toggleSelection: (path: string) => void;
	isSelected: (path: string) => boolean;
}

export function useFileItemActions(): UseFileItemActionsResult {
	const {
		selectedItems,
		isMultiSelectMode,
		setCurrentPath,
		setSelectedActionFile,
		toggleSelection: storeToggleSelection,
		setIsMultiSelectMode,
		setDraggedItem,
		setIsDragging,
		isSelected: storeIsSelected,
	} = useFileStore();

	const { openViewer } = useFileViewerStore();

	// 本地状态
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const [draggingItem, setDraggingItem] = useState<string | null>(null);
	const [showPinchHint, setShowPinchHint] = useState(false);

	// Pinch 手势状态
	const pinchState = useRef<PinchState | null>(null);
	const pinchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// ===== 文件项操作 =====

	const handleTap = useCallback(
		(item: FileItem) => {
			console.log("[useFileItemActions] handleTap:", item.name);
			try {
				if (isMultiSelectMode) {
					storeToggleSelection(item.path);
					return;
				}

				if (item.isDirectory) {
					console.log("[useFileItemActions] Navigating to:", item.path);
					setCurrentPath(item.path);
				} else {
					console.log("[useFileItemActions] Opening viewer:", item.path);
					openViewer(item.path, item.name, "view");
				}
			} catch (err) {
				console.error("[useFileItemActions] handleTap error:", err);
			}
		},
		[isMultiSelectMode, storeToggleSelection, setCurrentPath, openViewer],
	);

	const handleDoubleTap = useCallback(
		(item: FileItem) => {
			if (isMultiSelectMode) return;
			if (item.isDirectory) {
				setCurrentPath(item.path);
			}
		},
		[isMultiSelectMode, setCurrentPath],
	);

	const handleLongPress = useCallback(
		(item: FileItem) => {
			if (!isMultiSelectMode) {
				setIsMultiSelectMode(true);
			}
			storeToggleSelection(item.path);
		},
		[isMultiSelectMode, setIsMultiSelectMode, storeToggleSelection],
	);

	const handleSelectForAction = useCallback(
		(item: FileItem) => {
			setSelectedActionFile(item.path, item.name);
		},
		[setSelectedActionFile],
	);

	// ===== 拖拽操作 =====

	const handleDragStart = useCallback(
		(item: FileItem) => (e: React.DragEvent) => {
			setDraggedItem(item);
			setIsDragging(true);
			setDraggingItem(item.path);
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", item.path);
		},
		[setDraggedItem, setIsDragging],
	);

	const handleDragOver = useCallback(
		(item: FileItem) => (e: React.DragEvent) => {
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
		(targetItem: FileItem) => async (e: React.DragEvent) => {
			e.preventDefault();
			if (!targetItem.isDirectory) return;

			setDropTarget(null);
			setDraggingItem(null);

			try {
				await batchMoveFiles(selectedItems, targetItem.path);
			} catch (error) {
				console.error("Move failed:", error);
			}
		},
		[selectedItems],
	);

	const handleDragEnd = useCallback(() => {
		setDraggedItem(null);
		setIsDragging(false);
		setDraggingItem(null);
		setDropTarget(null);
	}, [setDraggedItem, setIsDragging]);

	// ===== 手势操作 =====

	const handleTouchStart = useCallback((e: React.TouchEvent) => {
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

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!pinchState.current?.isPinching || e.touches.length !== 2) return;

			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const currentDistance = Math.sqrt(
				(t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2,
			);

			const scale = currentDistance / pinchState.current.startDistance;

			// Pinch in (scale < 0.7) triggers multi-select
			if (scale < 0.7 && !isMultiSelectMode) {
				setIsMultiSelectMode(true);
				setShowPinchHint(true);

				if (pinchTimeoutRef.current) {
					clearTimeout(pinchTimeoutRef.current);
				}
				pinchTimeoutRef.current = setTimeout(() => {
					setShowPinchHint(false);
				}, 2000);
			}
		},
		[isMultiSelectMode, setIsMultiSelectMode],
	);

	const handleTouchEnd = useCallback(() => {
		pinchState.current = null;
	}, []);

	// ===== 选择操作 =====

	const toggleSelection = useCallback(
		(path: string) => {
			storeToggleSelection(path);
		},
		[storeToggleSelection],
	);

	const isSelected = useCallback(
		(path: string) => storeIsSelected(path),
		[storeIsSelected],
	);

	// ===== 返回绑定的处理器 =====

	const getItemHandlers = useCallback(
		(item: FileItem) => ({
			onTap: () => handleTap(item),
			onDoubleTap: () => handleDoubleTap(item),
			onLongPress: () => handleLongPress(item),
			onDragStart: handleDragStart(item),
			onDragOver: handleDragOver(item),
			onDragLeave: handleDragLeave,
			onDrop: handleDrop(item),
			onDragEnd: handleDragEnd,
			onToggleSelect: () => toggleSelection(item.path),
		}),
		[
			handleTap,
			handleDoubleTap,
			handleLongPress,
			handleDragStart,
			handleDragOver,
			handleDragLeave,
			handleDrop,
			handleDragEnd,
			toggleSelection,
		],
	);

	const getContainerHandlers = useCallback(
		() => ({
			onTouchStart: handleTouchStart,
			onTouchMove: handleTouchMove,
			onTouchEnd: handleTouchEnd,
		}),
		[handleTouchStart, handleTouchMove, handleTouchEnd],
	);

	return {
		isMultiSelectMode,
		selectedItems,
		draggingItem,
		dropTarget,
		showPinchHint,
		getItemHandlers,
		getContainerHandlers,
		toggleSelection,
		isSelected,
	};
}
