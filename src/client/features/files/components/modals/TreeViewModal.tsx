/**
 * TreeViewModal - 树状目录浏览模态窗口
 *
 * 抽离自 FileBottomMenu，独立为模态窗口组件
 * 支持层级显示（L0-L6）
 */

import React from "react";
import styles from "./TreeViewModal.module.css";

export interface TreeNode {
	path: string;
	name: string;
	isDirectory: boolean;
	children?: TreeNode[];
}

export interface TreeViewModalProps {
	isOpen: boolean;
	treeData: { path: string; items: TreeNode[] } | null;
	treeLoading: boolean;
	onClose: () => void;
	onFileClick: (path: string, name: string) => void;
}

export function TreeViewModal({
	isOpen,
	treeData,
	treeLoading,
	onClose,
	onFileClick,
}: TreeViewModalProps) {
	if (!isOpen) return null;

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.container} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<h3 className={styles.title}>
						<TreeIcon />
						Directory Tree: {treeData?.path || "."}
					</h3>
					<button className={styles.closeBtn} onClick={onClose} title="Close (ESC)">
						<CloseIcon />
					</button>
				</div>
				<div className={styles.content}>
					{treeLoading ? (
						<div className={styles.loading}>Loading...</div>
					) : treeData ? (
						<TreeNodeList items={treeData.items} onFileClick={onFileClick} />
					) : (
						<div className={styles.empty}>Failed to load directory tree</div>
					)}
				</div>
			</div>
		</div>
	);
}

// Tree Node List Component - 带层级显示
interface TreeNodeListProps {
	items: TreeNode[];
	onFileClick: (path: string, name: string) => void;
	level?: number;
}

function TreeNodeList({ items, onFileClick, level = 0 }: TreeNodeListProps) {
	if (!items || items.length === 0) return null;

	return (
		<>
			{items.map((item) => (
				<TreeNodeItem
					key={item.path}
					item={item}
					level={level}
					onFileClick={onFileClick}
				/>
			))}
		</>
	);
}

// Tree Node Item Component - 带层级标识
interface TreeNodeItemProps {
	item: TreeNode;
	level: number;
	onFileClick: (path: string, name: string) => void;
}

function TreeNodeItem({ item, level, onFileClick }: TreeNodeItemProps) {
	const [expanded, setExpanded] = React.useState(true);
	const hasChildren = item.children && item.children.length > 0;

	// 限制最大层级显示
	const displayLevel = Math.min(level, 6);

	const handleClick = () => {
		if (item.isDirectory && hasChildren) {
			setExpanded(!expanded);
		} else if (!item.isDirectory) {
			onFileClick(item.path, item.name);
		}
	};

	return (
		<div className={`${styles.node} ${styles[`level${displayLevel}`]}`}>
			<div
				className={styles.nodeHeader}
				style={{ paddingLeft: `${level * 24 + 8}px` }}
				onClick={handleClick}
			>
				{hasChildren && (
					<span className={styles.expandIcon}>{expanded ? "▼" : "▶"}</span>
				)}
				<span className={styles.icon}>{item.isDirectory ? "📁" : "📄"}</span>
				<span className={item.isDirectory ? styles.dirName : styles.fileName}>
					{item.name}
				</span>
				{/* 层级标识 */}
				<span className={styles.levelBadge}>L{displayLevel}</span>
			</div>
			{expanded && hasChildren && (
				<TreeNodeList
					items={item.children!}
					level={level + 1}
					onFileClick={onFileClick}
				/>
			)}
		</div>
	);
}

// Icons
function TreeIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="18"
			height="18"
		>
			<path d="M12 3v18M12 8l-4-4M12 8l4-4M8 12H4m16 0h-4M8 16H4m16 0h-4M8 20H4m16 0h-4" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="18" height="18">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
