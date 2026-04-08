# FileBottomMenu.tsx 历史版本记录

**文件路径**: `src/client/features/files/components/BottomMenu/FileBottomMenu.tsx`

---

## 提交: b9eb4ea9de35076e3be9cd2b8faef263ff5017ed
**日期**: 2026-04-05 13:13:42 +0000
**作者**: root <root@localhost.localdomain>
**消息**: refactor: feature-based architecture cleanup and session management

## 提交: 89d93f822a523ff223006560a600f6bb0e7037e3
**日期**: 2026-04-06 10:35:05 +0000
**作者**: root <root@localhost.localdomain>
**消息**: refactor(files): strict layer architecture with hooks and stores

## 提交: 43e09dfdf5c13f0959be29a28ab56c589358ab21
**日期**: 2026-04-06 17:03:11 +0000
**作者**: root <root@localhost.localdomain>
**消息**: refactor: unify import style to use @/ alias throughout the codebase

## 提交: d9317f940b8f578e87a6299e208dd15c8b500b17
**日期**: 2026-04-07 15:51:30 +0000
**作者**: root <root@localhost.localdomain>
**消息**: refactor(files): extract TreeViewModal from FileBottomMenu


---

# 详细版本内容


## 版本: b9eb4ea9de35076e3be9cd2b8faef263ff5017ed

```typescript
/**
 * FileBottomMenu - 文件功能底部菜单
 * 位于 APP Footer 上方，提供新建、删除、树状视图等功能
 */
import React, { useCallback, useEffect, useState } from "react";
import {
	getFileTree,
	type TreeNode,
	type TreeResponse,
} from "@/features/files/services/api/fileApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import styles from "./FileBottomMenu.module.css";

export function FileBottomMenu() {
	const [showNewModal, setShowNewModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showTreeModal, setShowTreeModal] = useState(false);
	const [newFileName, setNewFileName] = useState("");
	const [treeData, setTreeData] = useState<TreeResponse | null>(null);
	const [treeLoading, setTreeLoading] = useState(false);

	const {
		selectedItems,
		isMultiSelectMode,
		toggleMultiSelectMode,
		clearSelection,
		deleteSelectedItems,
		currentPath,
		createNewFile,
	} = useFileStore();

	const { openViewer } = useFileViewerStore();

	// 新建文件
	const handleNewClick = useCallback(() => {
		setShowNewModal(true);
		setNewFileName("");
	}, []);

	const handleConfirmNew = useCallback(async () => {
		if (!newFileName.trim()) return;
		const fileName = newFileName.trim();
		await createNewFile(fileName);
		setShowNewModal(false);
		setNewFileName("");
	}, [newFileName, createNewFile]);

	const handleCancelNew = useCallback(() => {
		setShowNewModal(false);
		setNewFileName("");
	}, []);

	// 删除文件
	const handleDeleteClick = useCallback(() => {
		if (selectedItems.length === 0) {
			// 如果没有选中任何文件，进入复选模式
			if (!isMultiSelectMode) {
				toggleMultiSelectMode();
			}
			return;
		}
		// 有选中文件，显示删除确认
		setShowDeleteModal(true);
	}, [selectedItems.length, isMultiSelectMode, toggleMultiSelectMode]);

	const handleConfirmDelete = useCallback(async () => {
		await deleteSelectedItems();
		setShowDeleteModal(false);
		clearSelection();
		if (isMultiSelectMode) {
			toggleMultiSelectMode();
		}
	}, [
		deleteSelectedItems,
		clearSelection,
		isMultiSelectMode,
		toggleMultiSelectMode,
	]);

	const handleCancelDelete = useCallback(() => {
		setShowDeleteModal(false);
	}, []);

	// 树状视图
	const handleTreeClick = useCallback(async () => {
		setShowTreeModal(true);
		setTreeLoading(true);
		try {
			console.log("[TreeView] Loading tree for path:", currentPath);
			const data = await getFileTree(currentPath);
			console.log("[TreeView] Loaded items count:", data.items.length);
			console.log("[TreeView] First 5 items:", data.items.slice(0, 5));
			setTreeData(data);
		} catch (error) {
			console.error("[TreeView] Failed to load file tree:", error);
		} finally {
			setTreeLoading(false);
		}
	}, [currentPath]);

	// 处理树中文件点击 - 在主界面打开文件查看器（保持树状弹窗打开）
	const handleTreeFileClick = useCallback(
		(filePath: string, fileName: string) => {
			// 构造完整路径
			const fullPath = currentPath ? `${currentPath}/${filePath}` : filePath;
			console.log("[TreeView] Opening file:", fullPath);
			// 在主界面打开文件查看器（树状弹窗保持打开）
			openViewer(fullPath, fileName, "view");
		},
		[currentPath, openViewer],
	);

	const handleCloseTree = useCallback(() => {
		setShowTreeModal(false);
		setTreeData(null);
	}, []);

	// ESC 关闭树状视图
	useEffect(() => {
		if (!showTreeModal) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleCloseTree();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [showTreeModal, handleCloseTree]);

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
					disabled={isMultiSelectMode && selectedItems.length === 0}
					title={
						isMultiSelectMode ? `Delete (${selectedItems.length})` : "Delete"
					}
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
					<div
						className={styles.deleteModal}
						onClick={(e) => e.stopPropagation()}
					>
						<div className={styles.deleteModalTitle}>
							<WarningIcon />
							Confirm Delete
						</div>
						<div className={styles.deleteModalText}>
							Delete {selectedItems.length} item(s)?
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

			{/* 树状视图全屏弹窗 */}
			{showTreeModal && (
				<div className={styles.treeFullscreenOverlay} onClick={handleCloseTree}>
					<div
						className={styles.treeFullscreenContainer}
						onClick={(e) => e.stopPropagation()}
					>
						<div className={styles.treeHeader}>
							<h3 className={styles.treeTitle}>
								<TreeIcon />
								Directory Tree: {treeData?.path || currentPath}
							</h3>
							<div className={styles.treeHeaderActions}>
								<button
									className={styles.treeCopyBtn}
									onClick={() => {
										if (treeData) {
											const treeText = buildTreeText(treeData.items);
											navigator.clipboard.writeText(treeText);
										}
									}}
									title="Copy directory tree"
									disabled={!treeData || treeLoading}
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								</button>
								<button
									className={styles.treeCloseBtn}
									onClick={handleCloseTree}
									title="Close (ESC)"
								>
									<CloseIcon />
								</button>
							</div>
						</div>
						<div className={styles.treeContent}>
							{treeLoading ? (
								<div className={styles.treeLoading}>Loading...</div>
							) : treeData ? (
								<TreeView
									items={treeData.items}
									onFileClick={handleTreeFileClick}
								/>
							) : (
								<div className={styles.treeEmpty}>
									Failed to load directory tree
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}

// 树状视图组件
function TreeView({
	items,
	onFileClick,
}: {
	items: TreeResponse["items"];
	onFileClick: (path: string, name: string) => void;
}) {
	if (!items || items.length === 0) {
		return <div className={styles.treeEmpty}>Empty directory</div>;
	}

	// 构建树结构
	const tree = buildTree(items);

	return (
		<div className={styles.treeView}>
			<TreeNode node={tree} level={0} onFileClick={onFileClick} />
		</div>
	);
}

const MAX_TREE_LEVEL = 10; // 最大支持10层目录

interface TreeNodeData {
	name: string;
	path: string;
	isDirectory: boolean;
	children: TreeNodeData[];
	isTruncated?: boolean; // 是否被截断（超过10层）
}

function buildTree(items: TreeNode[]): TreeNodeData {
	const root: TreeNodeData = {
		name: ".",
		path: "",
		isDirectory: true,
		children: [],
	};

	// Group items by their parent directory
	const itemMap = new Map<string, TreeNodeData>();

	for (const item of items) {
		const parts = item.path.split("/").filter(Boolean);
		if (parts.length === 0) continue;

		// 跳过超过10层的项目
		if (parts.length > MAX_TREE_LEVEL) continue;

		// Build path hierarchy
		let current = root;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const currentPath = parts.slice(0, i + 1).join("/");
			const isLast = i === parts.length - 1;
			const currentLevel = i + 1; // 当前层级（1-based）

			let node = itemMap.get(currentPath);
			if (!node) {
				node = {
					name: part,
					path: currentPath,
					isDirectory: isLast ? item.isDirectory : true,
					children: [],
					isTruncated: currentLevel >= MAX_TREE_LEVEL && !isLast,
				};
				itemMap.set(currentPath, node);
				current.children.push(node);
			}
			current = node;
		}
	}

	// Sort: directories first, then alphabetically
	sortTree(root);

	return root;
}

function sortTree(node: TreeNodeData) {
	node.children.sort((a, b) => {
		if (a.isDirectory && !b.isDirectory) return -1;
		if (!a.isDirectory && b.isDirectory) return 1;
		return a.name.localeCompare(b.name);
	});
	node.children.forEach(sortTree);
}

// 将树结构转换为文本表示
function buildTreeText(items: TreeNode[]): string {
	const tree = buildTree(items);
	return treeToText(tree, "");
}

function treeToText(node: TreeNodeData, prefix: string): string {
	if (node.name === ".") {
		// Root node - just render children
		return node.children.map((child) => treeToText(child, "")).join("");
	}

	let result = `${prefix}${node.name}${node.isDirectory ? "/" : ""}\n`;

	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		const isLast = i === node.children.length - 1;
		const childPrefix = prefix + (isLast ? "    " : "│   ");
		const connector = isLast ? "└── " : "├── ";

		result += `${prefix}${connector}${child.name}${child.isDirectory ? "/" : ""}\n`;

		if (child.children.length > 0) {
			result += treeToTextRecursive(child, childPrefix, "");
		}
	}

	return result;
}

function treeToTextRecursive(
	node: TreeNodeData,
	prefix: string,
	connector: string,
): string {
	let result = "";

	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		const isLast = i === node.children.length - 1;
		const childPrefix = prefix + (isLast ? "    " : "│   ");
		const childConnector = isLast ? "└── " : "├── ";

		result += `${prefix}${childConnector}${child.name}${child.isDirectory ? "/" : ""}\n`;

		if (child.children.length > 0) {
			result += treeToTextRecursive(child, childPrefix, "");
		}
	}

	return result;
}

function TreeNode({
	node,
	level,
	onFileClick,
}: {
	node: TreeNodeData;
	level: number;
	onFileClick: (path: string, name: string) => void;
}) {
	const [expanded, setExpanded] = useState(true); // 默认全部展开
	const hasChildren = node.children.length > 0;
	const isMaxLevel = level >= MAX_TREE_LEVEL;

	if (level === 0) {
		// Root node - just render children
		return (
			<>
				{node.children.map((child) => (
					<TreeNode
						key={child.path}
						node={child}
						level={level + 1}
						onFileClick={onFileClick}
					/>
				))}
			</>
		);
	}

	// 如果达到最大层级且有子项，显示截断提示
	if (isMaxLevel && hasChildren) {
		return (
			<div className={styles.treeNode}>
				<div
					className={styles.treeNodeHeader}
					style={{ paddingLeft: `${level * 12}px` }}
				>
					<span className={styles.treeExpandIconPlaceholder} />
					<span className={styles.treeIcon}>📁</span>
					<span className={styles.treeDirName}>{node.name}</span>
				</div>
				<div
					className={styles.treeNodeHeader}
					style={{ paddingLeft: `${(level + 1) * 12}px` }}
				>
					<span className={styles.treeExpandIconPlaceholder} />
					<span className={styles.treeTruncated}>... (max depth reached)</span>
				</div>
			</div>
		);
	}

	// 处理点击事件：目录折叠/展开，文件打开
	const handleClick = () => {
		if (node.isDirectory) {
			// 目录：切换展开/折叠
			if (hasChildren) {
				setExpanded(!expanded);
			}
		} else {
			// 文件：打开查看器
			onFileClick(node.path, node.name);
		}
	};

	return (
		<div className={styles.treeNode}>
			<div
				className={`${styles.treeNodeHeader} ${!node.isDirectory ? styles.treeFileClickable : ""}`}
				style={{ paddingLeft: `${level * 12}px` }}
				onClick={handleClick}
				title={
					node.isDirectory ? "Click to expand/collapse" : "Click to open file"
				}
			>
				{hasChildren ? (
					<span className={styles.treeExpandIcon}>{expanded ? "▼" : "▶"}</span>
				) : (
					<span className={styles.treeExpandIconPlaceholder} />
				)}
				<span className={styles.treeIcon}>
					{node.isDirectory ? "📁" : getFileIcon(node.name)}
				</span>
				<span
					className={
						node.isDirectory ? styles.treeDirName : styles.treeFileName
					}
				>
					{node.name}
				</span>
			</div>
			{expanded && hasChildren && (
				<div className={styles.treeChildren}>
					{node.children.map((child) => (
						<TreeNode
							key={child.path}
							node={child}
							level={level + 1}
							onFileClick={onFileClick}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function getFileIcon(name: string): string {
	const ext = name.split(".").pop()?.toLowerCase() || "";
	const iconMap: Record<string, string> = {
		js: "📜",
		ts: "📘",
		jsx: "⚛️",
		tsx: "⚛️",
		py: "🐍",
		java: "☕",
		go: "🐹",
		rs: "🦀",
		html: "🌐",
		css: "🎨",
		json: "📋",
		md: "📝",
		txt: "📄",
		yml: "⚙️",
		yaml: "⚙️",
	};
	return iconMap[ext] || "📄";
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
```


## 版本: 89d93f822a523ff223006560a600f6bb0e7037e3

```typescript
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
```


## 版本: 43e09dfdf5c13f0959be29a28ab56c589358ab21

```typescript
/**
 * FileBottomMenu - 文件功能底部菜单
 *
 * 职责：纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useFileBottomMenu hook 获取所有逻辑
 */

import React from "react";
import { useFileBottomMenu } from "@/features/files/hooks";
import styles from "@/features/files/components/BottomMenu/FileBottomMenu.module.css";

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
```


## 版本: d9317f940b8f578e87a6299e208dd15c8b500b17

```typescript
/**
 * FileBottomMenu - 文件功能底部菜单
 *
 * 职责：纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useFileBottomMenu hook 获取所有逻辑
 * - TreeView 已抽离到 modals/TreeViewModal
 */

import React from "react";
import { useFileBottomMenu } from "@/features/files/hooks";
import { TreeViewModal } from "@/features/files/components/modals/TreeViewModal";
import styles from "@/features/files/components/BottomMenu/FileBottomMenu.module.css";

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

			{/* 树状视图 - 使用抽离的 TreeViewModal 组件 */}
			<TreeViewModal
				isOpen={showTreeModal}
				treeData={treeData}
				treeLoading={treeLoading}
				onClose={handleCloseTree}
				onFileClick={handleTreeFileClick}
			/>
		</>
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
```

