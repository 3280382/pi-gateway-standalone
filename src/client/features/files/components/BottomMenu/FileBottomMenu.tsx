/**
 * FileBottomMenu - 文件功能底部菜单
 *
 * 职责：纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useFileBottomMenu hook 获取所有逻辑
 */

import React from "react";
import { useFileBottomMenu } from "@/features/files/hooks";
import styles from "./FileBottomMenu.module.css";

export function FileBottomMenu() {
	const {
		showNewModal,
		showDeleteModal,
		showTreeModal,
		newFileName,
		treeData,
		treeLoading,
		setNewFileName,
		handleNewClick,
		handleConfirmNew,
		handleCancelNew,
		handleDeleteClick,
		handleConfirmDelete,
		handleCancelDelete,
		handleTreeClick,
		handleTreeFileClick,
		handleCloseTree,
	} = useFileBottomMenu();

	return (
		<>
			<div className={styles.menu}>
				<button
					className={`${styles.btn} ${styles.newBtn}`}
					onClick={handleNewClick}
					title="New File"
				>
					<NewIcon />
				</button>
				<button
					className={`${styles.btn} ${styles.treeBtn}`}
					onClick={handleTreeClick}
					title="Tree View"
				>
					<TreeIcon />
				</button>
				<button
					className={`${styles.btn} ${styles.deleteBtn}`}
					onClick={handleDeleteClick}
					title="Delete"
				>
					<DeleteIcon />
				</button>
			</div>

			{/* 新建文件对话框 */}
			{showNewModal && (
				<div className={styles.modalOverlay} onClick={handleCancelNew}>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalTitle}>New File</div>
						<div className={styles.inputRow}>
							<input
								type="text"
								className={styles.input}
								value={newFileName}
								onChange={(e) => setNewFileName(e.target.value)}
								placeholder="Enter file name..."
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter") handleConfirmNew();
									if (e.key === "Escape") handleCancelNew();
								}}
							/>
						</div>
						<div className={styles.modalActions}>
							<button
								className={`${styles.modalBtn} ${styles.cancelBtn}`}
								onClick={handleCancelNew}
							>
								Cancel
							</button>
							<button
								className={`${styles.modalBtn} ${styles.confirmBtn}`}
								onClick={handleConfirmNew}
							>
								OK
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 删除确认对话框 */}
			{showDeleteModal && (
				<div className={styles.modalOverlay} onClick={handleCancelDelete}>
					<div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.deleteModalTitle}>
							<WarningIcon />
							Confirm Delete
						</div>
						<div className={styles.modalActions}>
							<button
								className={`${styles.modalBtn} ${styles.cancelBtn}`}
								onClick={handleCancelDelete}
							>
								Cancel
							</button>
							<button
								className={`${styles.modalBtn} ${styles.confirmBtn}`}
								onClick={handleConfirmDelete}
								style={{ background: "var(--accent-red)" }}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 树状视图 */}
			{showTreeModal && (
				<div className={styles.treeFullscreenOverlay} onClick={handleCloseTree}>
					<div
						className={styles.treeFullscreenContainer}
						onClick={(e) => e.stopPropagation()}
					>
						<TreeView
							treeData={treeData}
							treeLoading={treeLoading}
							onClose={handleCloseTree}
							onFileClick={handleTreeFileClick}
						/>
					</div>
				</div>
			)}
		</>
	);
}

// Tree View Component
interface TreeViewProps {
	treeData: { path: string; items: TreeNode[] } | null;
	treeLoading: boolean;
	onClose: () => void;
	onFileClick: (path: string, name: string) => void;
}

interface TreeNode {
	path: string;
	name: string;
	isDirectory: boolean;
	children?: TreeNode[];
}

function TreeView({ treeData, treeLoading, onClose, onFileClick }: TreeViewProps) {
	return (
		<>
			<div className={styles.treeHeader}>
				<h3 className={styles.treeTitle}>
					<TreeIcon />
					Directory Tree: {treeData?.path || "."}
				</h3>
				<button className={styles.treeCloseBtn} onClick={onClose} title="Close (ESC)">
					<CloseIcon />
				</button>
			</div>
			<div className={styles.treeContent}>
				{treeLoading ? (
					<div className={styles.treeLoading}>Loading...</div>
				) : treeData ? (
					<TreeNodeList items={treeData.items} onFileClick={onFileClick} />
				) : (
					<div className={styles.treeEmpty}>Failed to load directory tree</div>
				)}
			</div>
		</>
	);
}

// Tree Node List Component
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

// Tree Node Item Component
interface TreeNodeItemProps {
	item: TreeNode;
	level: number;
	onFileClick: (path: string, name: string) => void;
}

function TreeNodeItem({ item, level, onFileClick }: TreeNodeItemProps) {
	const [expanded, setExpanded] = React.useState(true);
	const hasChildren = item.children && item.children.length > 0;

	const handleClick = () => {
		if (item.isDirectory && hasChildren) {
			setExpanded(!expanded);
		} else if (!item.isDirectory) {
			onFileClick(item.path, item.name);
		}
	};

	return (
		<div className={styles.treeNode}>
			<div
				className={styles.treeNodeHeader}
				style={{ paddingLeft: `${level * 20}px` }}
				onClick={handleClick}
			>
				{hasChildren && (
					<span className={styles.treeExpandIcon}>{expanded ? "▼" : "▶"}</span>
				)}
				<span className={styles.treeIcon}>{item.isDirectory ? "📁" : "📄"}</span>
				<span className={item.isDirectory ? styles.treeDirName : styles.treeFileName}>
					{item.name}
				</span>
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
function NewIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
}

function TreeIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M12 3v18M12 8l-4-4M12 8l4-4M8 12H4m16 0h-4M8 16H4m16 0h-4M8 20H4m16 0h-4" />
		</svg>
	);
}

function DeleteIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	);
}

function WarningIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="20"
			height="20"
		>
			<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
