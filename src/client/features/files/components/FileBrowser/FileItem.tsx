/**
 * FileItem - 文件项组件
 *
 * 职责：纯 UI 渲染
 * - 无业务逻辑，只接收绑定好的处理器
 * - 长按触发多选模式（500ms延迟）
 */

import type React from "react";
import { memo, useCallback, useRef, useState } from "react";
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

const LONG_PRESS_DURATION = 500; // 500ms 长按触发

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
		// ========== 1. State ==========
		const [isPressed, setIsPressed] = useState(false);

		// ========== 2. Ref ==========
		const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

		// ========== 3. Effects ==========
		// 无外部副作用，使用事件处理器管理计时器

		// ========== 4. Computed ==========
		const icon = getFileIcon(item.extension, item.isDirectory);
		const isGrid = viewMode === "grid";

		// Git状态图标 - 使用更鲜艳的颜色和更明显的图标
		console.log('FileItem渲染:', { 
			name: item.name, 
			gitStatus: item.gitStatus,
			path: item.path 
		});
		const gitStatusIcon = item.gitStatus ? {
			untracked: { symbol: "🆕", color: "#f97316", textColor: "#ffffff" }, // 鲜艳橙色，白色文字
			modified: { symbol: "📝", color: "#eab308", textColor: "#000000" }, // 亮黄色，黑色文字
			added: { symbol: "➕", color: "#22c55e", textColor: "#ffffff" }, // 鲜艳绿色，白色文字
			deleted: { symbol: "🗑️", color: "#ef4444", textColor: "#ffffff" }, // 鲜艳红色，白色文字
			renamed: { symbol: "🔀", color: "#8b5cf6", textColor: "#ffffff" }, // 鲜艳紫色，白色文字
			copied: { symbol: "📋", color: "#0ea5e9", textColor: "#ffffff" }, // 鲜艳蓝色，白色文字
			conflict: { symbol: "⚡", color: "#dc2626", textColor: "#ffffff" }, // 深红色，白色文字
			other: { symbol: "❓", color: "#6b7280", textColor: "#ffffff" }, // 灰色，白色文字
		}[item.gitStatus] : null;

		// 组合样式
		const itemClassName = [
			isGrid ? styles.gridItem : styles.listItem,
			item.isDirectory ? styles.directory : "",
			isSelected ? styles.selected : "",
			isDropTarget ? styles.dropTarget : "",
			isDragging ? styles.dragging : "",
			isPressed ? styles.pressed : "",
		]
			.filter(Boolean)
			.join(" ");

		// ========== 5. Actions ==========
		// 处理鼠标按下 - 开始长按计时
		const handleMouseDown = useCallback(() => {
			setIsPressed(true);
			longPressTimerRef.current = setTimeout(() => {
				onLongPress();
			}, LONG_PRESS_DURATION);
		}, [onLongPress]);

		// 处理鼠标松开 - 取消长按计时
		const handleMouseUp = useCallback(() => {
			setIsPressed(false);
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			}
		}, []);

		// 处理鼠标离开 - 取消长按计时
		const handleMouseLeave = useCallback(() => {
			setIsPressed(false);
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			}
		}, []);

		// 处理点击
		const handleClick = useCallback(
			(e: React.MouseEvent) => {
				// 如果点击的是复选框，不触发 tap
				if (
					e.target instanceof HTMLElement &&
					e.target.closest('[data-checkbox="true"]')
				) {
					return;
				}
				onTap();
			},
			[onTap],
		);

		// ========== 6. Render ==========
		return (
			<div
				className={itemClassName}
				onClick={handleClick}
				onDoubleClick={onDoubleTap}
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseLeave}
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
					{gitStatusIcon && (
						<span 
							className={styles.gitBadge}
							style={{ 
								backgroundColor: gitStatusIcon.color,
								color: gitStatusIcon.textColor,
								filter: 'saturate(1.2) brightness(1.1)'
							}}
							title={`Git: ${item.gitStatus}`}
						>
							{gitStatusIcon.symbol}
						</span>
					)}
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
