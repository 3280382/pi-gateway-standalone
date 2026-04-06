/**
 * FileSidebar - 文件侧边栏（支持层级展开）
 */
import type React from "react";
import { useCallback } from "react";
import { useFileTree } from "@/features/files/hooks";
import { fileSidebarDebug } from "@/lib/debug";
import styles from "../FileBrowser/FileBrowser.module.css";

interface FileSidebarProps {
	visible: boolean;
	onNavigate?: (path: string) => void;
}

export function FileSidebar({ visible, onNavigate }: FileSidebarProps) {
	const { tree, loading, error, loadNodeChildren, toggleNode } = useFileTree();

	// 处理节点点击 - 展开/折叠 + 导航
	const handleNodeClick = useCallback(
		async (node: ReturnType<typeof useFileTree>["tree"][0], e: React.MouseEvent) => {
			fileSidebarDebug.debug("点击目录节点", { path: node.path });

			if (!node.isDirectory) return;

			// 阻止事件冒泡
			e.stopPropagation();

			// 导航到该目录
			if (onNavigate) {
				onNavigate(node.path);
			}

			// 加载子目录（如果未加载）
			if (!node.loaded) {
				await loadNodeChildren(node);
			} else {
				// 已加载则切换展开状态
				toggleNode(node);
			}
		},
		[onNavigate, loadNodeChildren, toggleNode],
	);

	// 递归渲染树节点
	const renderTreeNode = useCallback(
		(node: ReturnType<typeof useFileTree>["tree"][0], depth = 0) => {
			const hasChildren = node.childPaths.length > 0;
			const isExpanded = node.expanded;
			const isLoading = node.loading;

			return (
				<div key={node.path} className={styles.treeNode}>
					<div
						className={`${styles.treeNodeContent} ${depth > 0 ? styles.treeNodeIndented : ""}`}
						style={{ paddingLeft: `${depth * 12 + 8}px` }}
						onClick={(e) => handleNodeClick(node, e)}
					>
						{/* 展开/折叠图标 */}
						<span className={styles.treeNodeIcon}>
							{isLoading ? (
								<svg
									className={styles.spin}
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
								</svg>
							) : hasChildren ? (
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth={2}
									style={{
										transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
										transition: "transform 0.2s",
									}}
								>
									<polyline points="9 18 15 12 9 6" />
								</svg>
							) : (
								<span style={{ width: 16 }} />
							)}
						</span>

						{/* 目录图标 */}
						<span className={styles.treeNodeFolder}>📁</span>

						{/* 目录名称 */}
						<span className={styles.treeNodeName}>{node.name}</span>

						{/* 错误提示 */}
						{node.error && (
							<span className={styles.treeNodeError} title={node.error}>
								⚠️
							</span>
							)}
							</div>

					{/* 子目录 */}
					{isExpanded && node.children.length > 0 && (
						<div className={styles.treeNodeChildren}>
							{node.children.map((child) => renderTreeNode(child, depth + 1))}
						</div>
					)}
				</div>
			);
		},
		[handleNodeClick],
	);

	if (!visible) {
		return null;
	}

	return (
		<aside className={styles.sidebar}>
			<div className={styles.sidebarHeader}>
				<span className={styles.sidebarTitle}>📁 Folders</span>
			</div>
			<div className={styles.sidebarContent}>
				{loading ? (
					<div className={styles.sidebarLoading}>Loading...</div>
				) : error ? (
					<div className={styles.sidebarError}>{error}</div>
				) : (
					<div className={styles.treeContainer}>
						{tree.map((node) => renderTreeNode(node))}
					</div>
				)}
			</div>
		</aside>
	);
}
