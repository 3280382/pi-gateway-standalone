/**
 * LayoutContainer - Unified layout container component
 *
 * Provides a consistent layout structure for:
 * - Header (top)
 * - Footer (bottom)
 * - Sidebar (left/right)
 * - Panel (bottom overlay)
 *
 * Usage:
 * ```tsx
 * <LayoutContainer position="top" size={64} collapsible>
 *   <MyHeader />
 * </LayoutContainer>
 * ```
 */

import { useCallback, useState } from "react";
import styles from "./LayoutContainer.module.css";

export type LayoutPosition = "top" | "bottom" | "left" | "right";

export interface LayoutContainerProps {
	/** Position of the layout container */
	position: LayoutPosition;

	/** Size in pixels (height for top/bottom, width for left/right) */
	size: number;

	/** Whether the container can be collapsed */
	collapsible?: boolean;

	/** Default collapsed state */
	defaultCollapsed?: boolean;

	/** Callback when collapsed state changes */
	onCollapseChange?: (collapsed: boolean) => void;

	/** Content to render inside the container */
	children: React.ReactNode;

	/** Additional CSS class */
	className?: string;

	/** Whether this is an overlay panel (for bottom panels) */
	overlay?: boolean;

	/** For overlay panels: height can be resized */
	resizable?: boolean;

	/** For overlay panels: minimum height */
	minSize?: number;

	/** For overlay panels: maximum height */
	maxSize?: number;

	/** For overlay panels: callback when size changes */
	onSizeChange?: (size: number) => void;

	/** For overlay panels: callback when closed */
	onClose?: () => void;
}

export function LayoutContainer({
	position,
	size,
	collapsible = false,
	defaultCollapsed = false,
	onCollapseChange,
	children,
	className = "",
	overlay = false,
	resizable = false,
	minSize = 100,
	maxSize = 800,
	onSizeChange,
	onClose,
}: LayoutContainerProps) {
	const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
	const [currentSize, setCurrentSize] = useState(size);
	const [isResizing, setIsResizing] = useState(false);

	const toggleCollapse = useCallback(() => {
		const newState = !isCollapsed;
		setIsCollapsed(newState);
		onCollapseChange?.(newState);
	}, [isCollapsed, onCollapseChange]);

	const handleResizeStart = useCallback(() => {
		if (!resizable) return;
		setIsResizing(true);

		const handleMouseMove = (e: MouseEvent) => {
			const newSize = Math.max(
				minSize,
				Math.min(maxSize, window.innerHeight - e.clientY),
			);
			setCurrentSize(newSize);
			onSizeChange?.(newSize);
		};

		const handleMouseUp = () => {
			setIsResizing(false);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	}, [resizable, minSize, maxSize, onSizeChange]);

	// Build class names
	const containerClasses = [
		styles.container,
		styles[position],
		overlay && styles.overlay,
		isCollapsed && styles.collapsed,
		className,
	]
		.filter(Boolean)
		.join(" ");

	// Calculate styles based on position
	const style: React.CSSProperties = {
		[position === "left" || position === "right" ? "width" : "height"]:
			isCollapsed ? 0 : currentSize,
	};

	return (
		<div className={containerClasses} style={style}>
			{/* Resize handle for resizable panels */}
			{resizable && position === "bottom" && (
				<div
					className={`${styles.resizeHandle} ${isResizing ? styles.resizing : ""}`}
					onMouseDown={handleResizeStart}
				/>
			)}

			{/* Collapse toggle button */}
			{collapsible && (
				<button
					className={styles.collapseToggle}
					onClick={toggleCollapse}
					title={isCollapsed ? "Expand" : "Collapse"}
				>
					{isCollapsed ? "→" : "←"}
				</button>
			)}

			{/* Close button for overlay panels */}
			{overlay && onClose && (
				<button className={styles.closeButton} onClick={onClose} title="Close">
					×
				</button>
			)}

			{/* Content */}
			<div className={styles.content}>{children}</div>
		</div>
	);
}
