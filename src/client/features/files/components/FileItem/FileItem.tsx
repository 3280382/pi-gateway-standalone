/**
 * FileItem - Optimized file item with advanced gesture handling
 * Reduces false positives between tap, swipe, and long-press
 */
import React, { memo, useCallback, useRef, useState } from "react";
import { getFileIcon } from "@/services/api/fileApi";
import type { FileItem as FileItemType } from "@/stores/fileStore";
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

// Gesture detection constants
const TAP_THRESHOLD = 10; // pixels - max movement for a tap
const LONG_PRESS_DELAY = 500; // ms
const DOUBLE_TAP_DELAY = 300; // ms

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
		const [isPressed, setIsPressed] = useState(false);
		const [showRipple, setShowRipple] = useState(false);
		const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
		const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
		const lastTapTimeRef = useRef<number>(0);
		const isScrollingRef = useRef(false);
		const touchMovedRef = useRef(false);

		const icon = getFileIcon(item.extension, item.isDirectory);

		// Calculate distance between two points
		const getDistance = (x1: number, y1: number, x2: number, y2: number): number => {
			return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
		};

		// Handle touch start
		const handleTouchStart = useCallback(
			(e: React.TouchEvent) => {
				const touch = e.touches[0];
				touchStartRef.current = {
					x: touch.clientX,
					y: touch.clientY,
					time: Date.now(),
				};
				touchMovedRef.current = false;
				isScrollingRef.current = false;
				setIsPressed(true);

				// Start long press timer
				longPressTimerRef.current = setTimeout(() => {
					if (!touchMovedRef.current && !isScrollingRef.current) {
						setIsPressed(false);
						onLongPress(item);
					}
				}, LONG_PRESS_DELAY);
			},
			[item, onLongPress],
		);

		// Handle touch move - detect scrolling
		const handleTouchMove = useCallback(
			(e: React.TouchEvent) => {
				if (!touchStartRef.current) return;

				const touch = e.touches[0];
				const distance = getDistance(
					touchStartRef.current.x,
					touchStartRef.current.y,
					touch.clientX,
					touch.clientY,
				);

				// If moved beyond threshold, consider it scrolling
				if (distance > TAP_THRESHOLD) {
					touchMovedRef.current = true;
					isScrollingRef.current = true;
					setIsPressed(false);

					if (longPressTimerRef.current) {
						clearTimeout(longPressTimerRef.current);
						longPressTimerRef.current = null;
					}
				}
			},
			[],
		);

		// Handle touch end
		const handleTouchEnd = useCallback(
			(e: React.TouchEvent) => {
				// Clear long press timer
				if (longPressTimerRef.current) {
					clearTimeout(longPressTimerRef.current);
					longPressTimerRef.current = null;
				}

				setIsPressed(false);

				// If we were scrolling, don't process as tap
				if (isScrollingRef.current || touchMovedRef.current) {
					touchStartRef.current = null;
					return;
				}

				// Check if it was a valid tap
				if (touchStartRef.current) {
					const touch = e.changedTouches[0];
					const distance = getDistance(
						touchStartRef.current.x,
						touchStartRef.current.y,
						touch.clientX,
						touch.clientY,
					);
					const duration = Date.now() - touchStartRef.current.time;

					// Only process as tap if within threshold
					if (distance < TAP_THRESHOLD && duration < LONG_PRESS_DELAY) {
						const now = Date.now();
						const timeSinceLastTap = now - lastTapTimeRef.current;

						// Check for double tap
						if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
							onDoubleTap(item);
							lastTapTimeRef.current = 0; // Reset
						} else {
							// Single tap
							lastTapTimeRef.current = now;

							// Show ripple effect
							setShowRipple(true);
							setTimeout(() => setShowRipple(false), 300);

							// Small delay to allow visual feedback
							setTimeout(() => {
								onTap(item);
							}, 50);
						}
					}
				}

				touchStartRef.current = null;
			},
			[item, onTap, onDoubleTap],
		);

		// Handle mouse down (for desktop)
		const handleMouseDown = useCallback(() => {
			setIsPressed(true);
		}, []);

		// Handle mouse up (for desktop)
		const handleMouseUp = useCallback(() => {
			setIsPressed(false);
		}, []);

		// Handle mouse leave
		const handleMouseLeave = useCallback(() => {
			setIsPressed(false);
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
			}
		}, []);

		// Handle click (desktop fallback)
		const handleClick = useCallback(
			(e: React.MouseEvent) => {
				// Prevent if already handled by touch
				if (touchStartRef.current) return;

				if (isMultiSelectMode) {
					onToggleSelect(item.path);
				} else {
					const now = Date.now();
					if (now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
						onDoubleTap(item);
						lastTapTimeRef.current = 0;
					} else {
						lastTapTimeRef.current = now;
						onTap(item);
					}
				}
			},
			[isMultiSelectMode, item.path, onTap, onDoubleTap, onToggleSelect],
		);

		// Handle double click (desktop)
		const handleDoubleClick = useCallback(
			(e: React.MouseEvent) => {
				// Prevent default to avoid triggering click
				e.preventDefault();
				onDoubleTap(item);
			},
			[item, onDoubleTap],
		);

		// Handle checkbox click
		const handleCheckboxClick = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation();
				onToggleSelect(item.path);
			},
			[item.path, onToggleSelect],
		);

		const isGrid = viewMode === "grid";

		return (
			<div
				className={`${isGrid ? styles.gridItem : styles.listItem} ${
					item.isDirectory ? styles.directory : ""
				} ${isSelected ? styles.selected : ""} ${
					isDropTarget ? styles.dropTarget : ""
				} ${isDragging ? styles.dragging : ""} ${
					isPressed ? styles.pressed : ""
				}`}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onMouseDown={handleMouseDown}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseLeave}
				onClick={handleClick}
				onDoubleClick={handleDoubleClick}
				draggable={!item.isDirectory || isMultiSelectMode}
				onDragStart={(e) => onDragStart(e, item)}
				onDragOver={(e) => onDragOver(e, item)}
				onDragLeave={onDragLeave}
				onDrop={(e) => onDrop(e, item)}
				onDragEnd={onDragEnd}
				data-path={item.path}
			>
				{/* Ripple effect */}
				{showRipple && <span className={styles.ripple} />}

				{/* Checkbox for multi-select */}
				{isMultiSelectMode && (
					<div
						className={styles.checkbox}
						onClick={handleCheckboxClick}
						role="checkbox"
						aria-checked={isSelected}
					>
						{isSelected ? "☑" : "☐"}
					</div>
				)}

				{/* Icon */}
				<span className={isGrid ? styles.gridIcon : styles.listIcon}>{icon}</span>

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

// Helper functions
function formatFileSize(size?: number): string {
	if (size === undefined || size === null) return "";
	if (size < 1024) return `${size}B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
	return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(dateString?: string): string {
	if (!dateString) return "";
	try {
		return new Date(dateString).toLocaleDateString();
	} catch {
		return dateString;
	}
}
