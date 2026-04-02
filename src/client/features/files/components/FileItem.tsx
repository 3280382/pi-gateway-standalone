/**
 * FileItem - Refactored file item component
 *
 * Architecture:
 * - UI Layer: Pure rendering
 * - Logic Layer: Delegated to hooks (useGesture, useDragDrop)
 * - Utils: Pure functions from lib/
 *
 * Before: 356 lines with mixed concerns
 * After: ~150 lines, focused on UI only
 */
import type React from "react";
import { memo, useCallback, useRef, useState } from "react";
import { useGesture } from "@/features/files/hooks/useGesture";
import { getFileIcon } from "@/features/files/services/api/fileApi";
import type { FileItem as FileItemType } from "@/features/files/stores/fileStore";
import { formatDate, formatFileSize } from "@/lib/formatters";
import styles from "./FileItem.module.css";

interface FileItemProps {
	item: FileItemType;
	isSelected: boolean;
	isMultiSelectMode: boolean;
	isDropTarget: boolean;
	isDragging: boolean;
	onTap: (item: FileItemType) => void;
	onDoubleTap: (item: FileItemType) => void;
	onLongPress: (item: FileItemType) => void;
	onDragStart: (e: React.DragEvent, item: FileItemType) => void;
	onDragOver: (e: React.DragEvent, item: FileItemType) => void;
	onDragLeave: () => void;
	onDrop: (e: React.DragEvent, item: FileItemType) => void;
	onDragEnd: () => void;
	onToggleSelect: (path: string) => void;
	viewMode: "grid" | "list";
}

export const FileItem = memo<FileItemProps>(
	({
		item,
		isSelected,
		isMultiSelectMode,
		isDropTarget,
		isDragging,
		onTap,
		onDoubleTap,
		onLongPress,
		onDragStart,
		onDragOver,
		onDragLeave,
		onDrop,
		onDragEnd,
		onToggleSelect,
		viewMode,
	}) => {
		const [showRipple, setShowRipple] = useState(false);
		const checkboxRef = useRef<HTMLDivElement>(null);

		const icon = getFileIcon(item.extension, item.isDirectory);
		const isGrid = viewMode === "grid";

		// 使用 useGesture hook 处理所有手势
		const { state: gestureState, handlers } = useGesture({
			onTap: useCallback(() => {
				setShowRipple(true);
				setTimeout(() => setShowRipple(false), 300);
				onTap(item);
			}, [item, onTap]),
			onDoubleTap: useCallback(() => {
				onDoubleTap(item);
			}, [item, onDoubleTap]),
			onLongPress: useCallback(() => {
				onLongPress(item);
			}, [item, onLongPress]),
		});

		// 复选框点击处理
		const handleCheckboxClick = useCallback(
			(e: React.MouseEvent | React.TouchEvent) => {
				e.preventDefault();
				e.stopPropagation();
				onToggleSelect(item.path);
			},
			[item.path, onToggleSelect],
		);

		// 拖拽处理
		const handleDragStart = useCallback(
			(e: React.DragEvent) => {
				onDragStart(e, item);
			},
			[item, onDragStart],
		);

		const handleDragOver = useCallback(
			(e: React.DragEvent) => {
				onDragOver(e, item);
			},
			[item, onDragOver],
		);

		const handleDrop = useCallback(
			(e: React.DragEvent) => {
				onDrop(e, item);
			},
			[item, onDrop],
		);

		// 组合样式
		const itemClassName = [
			isGrid ? styles.gridItem : styles.listItem,
			item.isDirectory ? styles.directory : "",
			isSelected ? styles.selected : "",
			isDropTarget ? styles.dropTarget : "",
			isDragging ? styles.dragging : "",
			gestureState.isPressed ? styles.pressed : "",
		].join(" ");

		return (
			<div
				className={itemClassName}
				{...handlers}
				draggable={!item.isDirectory || isMultiSelectMode}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragLeave={onDragLeave}
				onDrop={handleDrop}
				onDragEnd={onDragEnd}
				data-path={item.path}
			>
				{/* Ripple effect */}
				{showRipple && <span className={styles.ripple} />}

				{/* Checkbox for multi-select */}
				{isMultiSelectMode && (
					<div
						ref={checkboxRef}
						className={styles.checkbox}
						onClick={handleCheckboxClick}
						onTouchStart={handleCheckboxClick}
						role="checkbox"
						aria-checked={isSelected}
						data-checkbox="true"
					>
						{isSelected ? "☑" : "☐"}
					</div>
				)}

				{/* Icon */}
				<span className={isGrid ? styles.gridIcon : styles.listIcon}>
					{icon}
				</span>

				{/* Name */}
				<span className={isGrid ? styles.gridName : styles.listName}>
					{item.name}
				</span>

				{/* List view extra info */}
				{!isGrid && (
					<>
						<span className={styles.listSize}>
							{item.isDirectory ? "" : formatFileSize(item.size)}
						</span>
						<span className={styles.listModified}>
							{formatDate(item.modified)}
						</span>
					</>
				)}

				{/* Selection indicator ring */}
				{isSelected && !isMultiSelectMode && (
					<div className={styles.selectionRing} />
				)}
			</div>
		);
	},
);

FileItem.displayName = "FileItem";
