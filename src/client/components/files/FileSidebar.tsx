/**
 * FileSidebar - 文件侧边栏（支持层级展开）
 */
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { fileSidebarDebug } from "@/lib/debug";
import { browseDirectory } from "@/services/api/fileApi";
import { useFileStore } from "@/stores/fileStore";
import styles from "./FileBrowser.module.css";

interface FileSidebarProps {
	visible: boolean;
	onNavigate?: (path: string) => void; // 导航回调
}

interface TreeNode {
	name: string;
	path: string;
	isDirectory: boolean;
	children: TreeNode[]; // 子节点对象数组
	childPaths: string[]; // 子目录路径数组（用于加载）
	loaded: boolean;
	loading?: boolean;
	error?: string;
	expanded?: boolean; // 是否展开
}

export function FileSidebar({ visible, onNavigate }: FileSidebarProps) {
	const [tree, setTree] = useState<TreeNode[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// 获取fileStore的setCurrentPath方法
	const { setCurrentPath } = useFileStore();

	// 加载目录内容
	const loadDirectory = useCallback(async (path: string): Promise<TreeNode> => {
		fileSidebarDebug.info("加载目录", { path });

		try {
			const data = await browseDirectory(path);

			// 只保留子目录路径
			const childDirs = data.items
				.filter((item) => item.isDirectory)
				.map((item) => item.path);

			const node: TreeNode = {
				name: data.currentPath.split("/").pop() || "/",
				path: data.currentPath,
				isDirectory: true,
				children: [], // 初始为空，展开时加载
				childPaths: childDirs, // 保存子目录路径
				loaded: false,
				expanded: false,
			};

			fileSidebarDebug.info("目录节点创建", {
				path,
				name: node.name,
				childCount: childDirs.length,
			});

			return node;
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "加载失败";
			fileSidebarDebug.error("目录加载失败", { path, error: errorMsg });
			throw err;
		}
	}, []);

	// 加载根目录
	const loadRoot = useCallback(async () => {
		fileSidebarDebug.info("加载根目录树");
		setLoading(true);
		setError(null);

		try {
			const rootNode = await loadDirectory("/root");
			setTree([rootNode]);
			setLoading(false);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "根目录加载失败";
			setError(errorMsg);
			setLoading(false);
		}
	}, [loadDirectory]);

	// 展开/折叠节点
	// 处理节点点击 - 展开/折叠 + 导航
	const handleNodeClick = useCallback(
		async (node: TreeNode, e: React.MouseEvent) => {
			fileSidebarDebug.debug("点击目录节点", { path: node.path });

			if (!node.isDirectory) return;

			// 阻止事件冒泡
			e.stopPropagation();

			// 导航到该目录（更新右侧面板）
			fileSidebarDebug.info("导航到目录", { path: node.path });
			setCurrentPath(node.path);
			if (onNavigate) {
				onNavigate(node.path);
			}

			// 切换展开状态
			if (node.expanded) {
				// 已展开则折叠
				setTree((prev) =>
					updateNodeInTree(prev, node.path, { expanded: false }),
				);
			} else {
				// 未展开则加载并展开
				if (!node.loaded && node.childPaths.length > 0) {
					setTree((prev) =>
						updateNodeInTree(prev, node.path, { loading: true }),
					);

					try {
						const childNodes = await Promise.all(
							node.childPaths.map((childPath) => loadDirectory(childPath)),
						);

						setTree((prev) =>
							updateNodeInTree(prev, node.path, {
								children: childNodes,
								loaded: true,
								loading: false,
								expanded: true,
							}),
						);

						fileSidebarDebug.info("子目录加载完成", {
							parent: node.path,
							children: childNodes.length,
						});
					} catch (err) {
						const errorMsg = err instanceof Error ? err.message : "加载失败";
						setTree((prev) =>
							updateNodeInTree(prev, node.path, {
								loading: false,
								error: errorMsg,
							}),
						);
					}
				} else {
					// 已加载，直接展开
					setTree((prev) =>
						updateNodeInTree(prev, node.path, { expanded: true }),
					);
				}
			}
		},
		[loadDirectory, setCurrentPath, onNavigate],
	);

	// 辅助函数：更新树中的节点
	const updateNodeInTree = (
		nodes: TreeNode[],
		targetPath: string,
		updates: Partial<TreeNode>,
	): TreeNode[] => {
		return nodes.map((node) => {
			if (node.path === targetPath) {
				return { ...node, ...updates };
			}
			if (node.children.length > 0) {
				return {
					...node,
					children: updateNodeInTree(node.children, targetPath, updates),
				};
			}
			return node;
		});
	};

	// 渲染树节点（递归）
	const renderTreeNode = (node: TreeNode, level: number = 0) => {
		const paddingLeft = 12 + level * 16;

		return (
			<div key={node.path}>
				<div
					className={styles.treeItem}
					style={{ paddingLeft: `${paddingLeft}px` }}
					onClick={(e) => handleNodeClick(node, e)}
				>
					<span className={styles.treeIcon}>
						{node.loading
							? "⏳"
							: node.isDirectory
								? node.expanded
									? "📂"
									: "📁"
								: "📄"}
					</span>
					<span className={styles.treeLabel}>{node.name}</span>
					{node.isDirectory && node.childPaths.length > 0 && (
						<span className={styles.treeExpandIcon}>
							{node.expanded ? "▼" : "▶"}
						</span>
					)}
				</div>

				{/* 递归渲染子节点 */}
				{node.expanded && node.children.length > 0 && (
					<div className={styles.treeChildren}>
						{node.children.map((child) => renderTreeNode(child, level + 1))}
					</div>
				)}
			</div>
		);
	};

	// 初始加载
	useEffect(() => {
		if (visible) {
			loadRoot();
		} else {
			setTree([]);
			setLoading(true);
		}
	}, [visible, loadRoot]);

	const sidebarClass = visible
		? `${styles.sidebar} ${styles.visible}`
		: styles.sidebar;

	return (
		<aside className={sidebarClass}>
			<div className={styles.sidebarHeader}>
				<span>📁 Files</span>
				<button
					className={styles.clearCacheBtn}
					onClick={loadRoot}
					title="Refresh"
				>
					🔄
				</button>
			</div>

			<div className={styles.tree}>
				{loading ? (
					<div className={styles.treeLoading}>
						<span className={styles.treeLoadingIcon}>⏳</span>
						Loading...
					</div>
				) : error ? (
					<div className={styles.treeError}>
						<span>❌</span>
						{error}
						<button onClick={loadRoot}>Retry</button>
					</div>
				) : tree.length === 0 ? (
					<div className={styles.treeEmpty}>No directories found</div>
				) : (
					tree.map((node) => renderTreeNode(node))
				)}
			</div>
		</aside>
	);
}
