/**
 * useFileItemActions - 文件项操作逻辑 Hook
 *
 * 职责：管理文件项的交互操作（点击、选择、拖拽等）
 */

import { useCallback, useState } from "react";
import type { FileItem } from "@/features/files/stores/fileStore";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";

export interface UseFileItemActionsResult {
	// 状态
	isMultiSelectMode: boolean;
	selectedItems: string[];
	draggingItem: string | null;
	dropTarget: string | null;

	// 操作方法
	handleTap: (item: FileItem) => void;
	handleDoubleTap: (item: FileItem) => void;
	handleLongPress: (item: FileItem) => void;
	handleSelectForAction: (item: FileItem) => void;

	// 拖拽
	handleDragStart: (item: FileItem) => void;
	handleDragEnd: () => void;
	handleDragOver: (item: FileItem) => void;
	handleDragLeave: () => void;
	handleDrop: (targetItem: FileItem) => Promise<void>;

	// 多选
	toggleSelection: (path: string) => void;
	isSelected: (path: string) => boolean;
}

export function useFileItemActions(): UseFileItemActionsResult {
	const {
		selectedItems,
		isMultiSelectMode,
		setCurrentPath,
		selectForAction,
		toggleSelection: storeToggleSelection,
		setMultiSelectMode,
		setDraggedItem,
		setIsDragging,
		moveSelectedItems: storeMoveSelectedItems,
		isSelected: storeIsSelected,
	} = useFileStore();

	const { openViewer } = useFileViewerStore();

	// 本地状态
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const [draggingItem, setDraggingItem] = useState<string | null>(null);

	// 处理单击/点击
	const handleTap = useCallback(
		(item: FileItem) => {
			if (isMultiSelectMode) {
				storeToggleSelection(item.path);
				return;
			}

			if (item.isDirectory) {
				setCurrentPath(item.path);
			} else {
				// 单击打开文件
				openViewer(item.path, item.name, "view");
			}
		},
		[isMultiSelectMode, storeToggleSelection, setCurrentPath, openViewer],
	);

	// 处理双击
	const handleDoubleTap = useCallback(
		(item: FileItem) => {
			if (isMultiSelectMode) return;
			if (item.isDirectory) {
				setCurrentPath(item.path);
			}
		},
		[isMultiSelectMode, setCurrentPath],
	);

	// 处理长按（进入多选模式）
	const handleLongPress = useCallback(
		(item: FileItem) => {
			if (!isMultiSelectMode) {
				setMultiSelectMode(true);
			}
			storeToggleSelection(item.path);
		},
		[isMultiSelectMode, setMultiSelectMode, storeToggleSelection],
	);

	// 选中用于操作（查看/编辑）
	const handleSelectForAction = useCallback(
		(item: FileItem) => {
			selectForAction(item.path, item.name);
		},
		[selectForAction],
	);

	// 拖拽开始
	const handleDragStart = useCallback(
		(item: FileItem) => {
			setDraggedItem(item);
			setIsDragging(true);
			setDraggingItem(item.path);
		},
		[setDraggedItem, setIsDragging],
	);

	// 拖拽结束
	const handleDragEnd = useCallback(() => {
		setDraggedItem(null);
		setIsDragging(false);
		setDraggingItem(null);
		setDropTarget(null);
	}, [setDraggedItem, setIsDragging]);

	// 拖拽经过
	const handleDragOver = useCallback(
		(item: FileItem) => {
			if (item.isDirectory) {
				setDropTarget(item.path);
			}
		},
		[],
	);

	// 拖拽离开
	const handleDragLeave = useCallback(() => {
		setDropTarget(null);
	}, []);

	// 放置
	const handleDrop = useCallback(
		async (targetItem: FileItem) => {
			if (!targetItem.isDirectory) return;

			setDropTarget(null);
			setDraggingItem(null);

			try {
				await storeMoveSelectedItems(targetItem.path);
			} catch (error) {
				console.error("Move failed:", error);
			}
		},
		[storeMoveSelectedItems],
	);

	// 切换选择（用于多选）
	const toggleSelection = useCallback(
		(path: string) => {
			storeToggleSelection(path);
		},
		[storeToggleSelection],
	);

	// 判断是否选中
	const isSelected = useCallback(
		(path: string) => {
			return storeIsSelected(path);
		},
		[storeIsSelected],
	);

	return {
		isMultiSelectMode,
		selectedItems,
		draggingItem,
		dropTarget,
		handleTap,
		handleDoubleTap,
		handleLongPress,
		handleSelectForAction,
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		toggleSelection,
		isSelected,
	};
}
