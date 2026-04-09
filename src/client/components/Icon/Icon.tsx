/**
 * Icon - 统一图标组件
 *
 * 职责：
 * - 纯展示时：渲染 SVG 图标
 * - 有 onClick 时：自动变成按钮
 * - 支持文字组合
 * - 统一管理所有 SVG 图标
 */

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import styles from "./Icon.module.css";

export type IconName =
	// 导航
	| "leftArrow"
	| "rightArrow"
	| "upArrow"
	| "downArrow"
	// 视图
	| "chat"
	| "files"
	| "settings"
	| "tools"
	// 操作
	| "bug"
	| "robot"
	| "check"
	| "close"
	| "plus"
	| "trash"
	| "edit"
	| "refresh"
	| "document"
	// 文件
	| "folder"
	| "file"
	| "grid"
	| "list"
	// 其他
	| "moon"
	| "sun"
	| "log"
	| "view"
	| "search"
	| "more";

export interface IconProps {
	/** 图标名称 */
	name: IconName;
	/** 图标尺寸 */
	size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
	/** 颜色 */
	color?: string;
	/** 自定义类名 */
	className?: string;
	/** 自定义样式 */
	style?: CSSProperties;
}

export interface IconButtonProps
	extends IconProps,
		Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "name"> {
	/** 按钮文字（可选） */
	label?: string;
	/** 图标位置 */
	iconPosition?: "left" | "right";
	/** 按钮变体 */
	variant?: "default" | "primary" | "ghost" | "danger" | "toggle";
	/** 是否激活（用于 toggle 变体） */
	isActive?: boolean;
	/** 后缀内容（如 check 标记） */
	suffix?: ReactNode;
}

const sizeMap = {
	xs: 12,
	sm: 14,
	md: 16,
	lg: 18,
	xl: 20,
};

/**
 * Icon - 纯图标展示
 */
export function Icon({
	name,
	size = "md",
	color = "currentColor",
	className = "",
	style = {},
}: IconProps) {
	const pixelSize = typeof size === "number" ? size : sizeMap[size];

	const iconStyle: CSSProperties = {
		width: pixelSize,
		height: pixelSize,
		color,
		...style,
	};

	const iconContent = icons[name];
	if (!iconContent) {
		console.warn(`Icon "${name}" not found`);
		return null;
	}

	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`${styles.icon} ${className}`}
			style={iconStyle}
		>
			{iconContent}
		</svg>
	);
}

/**
 * IconButton - 带按钮功能的图标
 * 自动根据是否有 onClick 决定渲染方式
 */
export function IconButton({
	name,
	label,
	iconPosition = "left",
	variant = "default",
	size = "md",
	isActive = false,
	suffix,
	className = "",
	disabled,
	title,
	onClick,
	...props
}: IconButtonProps) {
	// 如果没有 onClick，当作纯图标渲染
	if (!onClick) {
		return <Icon name={name} size={size} className={className} />;
	}

	const buttonClass = [
		styles.button,
		styles[variant],
		isActive && styles.active,
		disabled && styles.disabled,
		!label && styles.iconOnly,
		className,
	]
		.filter(Boolean)
		.join(" ");

	const iconSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";

	return (
		<button
			className={buttonClass}
			onClick={onClick}
			disabled={disabled}
			title={title}
			{...props}
		>
			{iconPosition === "left" && <Icon name={name} size={iconSize} />}

			{label && <span className={styles.label}>{label}</span>}

			{iconPosition === "right" && <Icon name={name} size={iconSize} />}

			{suffix && <span className={styles.suffix}>{suffix}</span>}
		</button>
	);
}

/**
 * IconToggle - 带切换状态的图标按钮
 */
interface IconToggleProps extends Omit<IconButtonProps, "name" | "isActive"> {
	/** 激活状态图标 */
	activeIcon: IconName;
	/** 非激活状态图标 */
	inactiveIcon: IconName;
	/** 当前是否激活 */
	isActive: boolean;
}

export function IconToggle({
	activeIcon,
	inactiveIcon,
	isActive,
	...props
}: IconToggleProps) {
	return (
		<IconButton
			name={isActive ? activeIcon : inactiveIcon}
			variant="toggle"
			isActive={isActive}
			{...props}
		/>
	);
}

// 图标定义
const icons: Record<IconName, ReactNode> = {
	// 导航
	leftArrow: (
		<>
			<path d="M19 12H5" />
			<path d="M12 19l-7-7 7-7" />
		</>
	),
	rightArrow: (
		<>
			<path d="M5 12h14" />
			<path d="M12 5l7 7-7 7" />
		</>
	),
	upArrow: (
		<>
			<path d="M12 19V5" />
			<path d="M5 12l7-7 7 7" />
		</>
	),
	downArrow: (
		<>
			<path d="M12 5v14" />
			<path d="M19 12l-7 7-7-7" />
		</>
	),

	// 视图
	chat: (
		<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
	),
	files: (
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
	),
	settings: (
		<>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</>
	),
	tools: (
		<>
			<circle cx="12" cy="12" r="3" />
			<path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24 4.24l-4.24-4.24M6.34 6.34L2.1 2.1" />
		</>
	),

	// 操作
	bug: (
		<>
			<path d="m8 2 1.88 1.88" />
			<path d="M14.12 3.88 16 2" />
			<path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
			<path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
			<path d="M12 20v-9" />
			<path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
			<path d="M6 13H2" />
			<path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
			<path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
			<path d="M22 13h-4" />
			<path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
		</>
	),
	robot: (
		<>
			<path d="M12 8V4H8" />
			<rect width="16" height="12" x="4" y="8" rx="2" />
			<path d="M2 14h2" />
			<path d="M20 14h2" />
			<path d="M15 13v2" />
			<path d="M9 13v2" />
		</>
	),
	check: <polyline points="20 6 9 17 4 12" />,
	close: (
		<>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</>
	),
	plus: (
		<>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</>
	),
	trash: (
		<>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</>
	),
	edit: (
		<>
			<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
			<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
		</>
	),
	refresh: (
		<>
			<polyline points="23 4 23 10 17 10" />
			<polyline points="1 20 1 14 7 14" />
			<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
		</>
	),
	document: (
		<>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<polyline points="10 9 9 9 8 9" />
		</>
	),

	// 文件
	folder: (
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
	),
	file: (
		<>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</>
	),
	grid: (
		<>
			<rect x="3" y="3" width="7" height="7" />
			<rect x="14" y="3" width="7" height="7" />
			<rect x="14" y="14" width="7" height="7" />
			<rect x="3" y="14" width="7" height="7" />
		</>
	),
	list: (
		<>
			<line x1="8" y1="6" x2="21" y2="6" />
			<line x1="8" y1="12" x2="21" y2="12" />
			<line x1="8" y1="18" x2="21" y2="18" />
			<line x1="3" y1="6" x2="3.01" y2="6" />
			<line x1="3" y1="12" x2="3.01" y2="12" />
			<line x1="3" y1="18" x2="3.01" y2="18" />
		</>
	),

	// 其他
	moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
	sun: (
		<>
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
		</>
	),
	log: (
		<>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
		</>
	),
	view: (
		<>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
			<circle cx="12" cy="12" r="3" />
		</>
	),
	search: (
		<>
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</>
	),
	more: (
		<>
			<circle cx="12" cy="12" r="1" />
			<circle cx="19" cy="12" r="1" />
			<circle cx="5" cy="12" r="1" />
		</>
	),
};

export default Icon;
