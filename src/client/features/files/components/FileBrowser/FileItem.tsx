/**
 * FileItem - 文件项组件
 *
 * 职责：纯 UI 渲染
 * - 无交互逻辑，只接收绑定好的处理器
 */

import type React from "react";
import { memo } from "react";
import { getFileIcon } from "@/features/files/services/api/fileApi";
import type { FileItem as FileItemType } from "@/features/files/stores/fileStore";
import { formatDate, formatFileSize } from "@/lib/formatters";
import styles from "./FileItem.module.css";

export interface FileItemProps {
	item: FileItemType;
	isSelected: boolean;
	isMultiSelectMode: boolean;
	isDropTarget: boolean;
	isDragging: boolean;
	onTap: () => void;
	onDoubleTap: () => void;
	onLongPress: () => void;
	onDragStart: (e: React.DragEvent) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDragLeave: () => void;
	onDrop: (e: React.DragEvent) => void;
	onDragEnd: () => void;
	onToggleSelect: () => void;
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
		const icon = getFileIcon(item.extension, item.isDirectory);
		const isGrid = viewMode === "grid";

		// 组合样式
		const itemClassName = [
			isGrid ? styles.gridItem : styles.listItem,
			item.isDirectory ? styles.directory : "",
			isSelected ? styles.selected : "",
			isDropTarget ? styles.dropTarget : "",
			isDragging ? styles.dragging : "",
		]
			.filter(Boolean)
			.join(" ");

		return (
			<div
				className={itemClassName}
				onClick={onTap}
				onDoubleClick={onDoubleTap}
				onMouseDown={onLongPress}
				draggable={!item.isDirectory || isMultiSelectMode}
				onDragStart={onDragStart}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
				onDragEnd={onDragEnd}
				data-path={item.path}
			>
				{/* Checkbox for multi-select */}
				{isMultiSelectMode && (
					<div
						className={styles.checkbox}
						onClick={(e) => {
							e.stopPropagation();
							onToggleSelect();
						}}
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
							{item.isDirectory ? "-" : formatFileSize(item.size)}
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
