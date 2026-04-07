/**
 * TreeViewModal - 紧凑全屏树状目录浏览模态窗口
 *
 * 特性：
 * - 全屏显示（宽高 100%）
 * - ASCII 树状格式显示层级
 * - 紧凑布局
 * - 过滤功能
 * - 不同文件类型不同图标
 * - 复制树状文本功能
 */

import React, { useState, useMemo, useCallback } from "react";
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

const DEFAULT_EXCLUDES = [
	"node_modules", "__pycache__", ".git", ".svn", ".hg",
	"dist", "build", ".next", ".nuxt", "coverage",
	".coverage", ".idea", ".vscode",
];

type FilterMode = "normal" | "all" | "search";

// 获取文件图标
function getFileIcon(name: string, isDirectory: boolean): string {
	if (isDirectory) return "📁";
	const ext = name.split(".").pop()?.toLowerCase() || "";
	
	const icons: Record<string, string> = {
		js: "📜", ts: "📘", jsx: "⚛️", tsx: "⚛️", py: "🐍",
		java: "☕", go: "🔵", rs: "🦀", c: "🔧", cpp: "🔧",
		h: "📋", hpp: "📋", cs: "🔷", php: "🐘", rb: "💎",
		sh: "🐚", bash: "🐚", html: "🌐", json: "📋",
		yaml: "📋", yml: "📋", md: "📝", css: "🎨",
		scss: "🎨", png: "🖼️", jpg: "🖼️", svg: "🎨",
		txt: "📄", pdf: "📕", zip: "📦", "7z": "📦",
	};
	return icons[ext] || "📄";
}

// 生成完整树文本
function generateTreeText(items: TreeNode[], prefix = ""): string {
	let result = "";
	items.forEach((item, index) => {
		const isLast = index === items.length - 1;
		const line = prefix + (isLast ? "`-- " : "|-- ") + 
			getFileIcon(item.name, item.isDirectory) + " " + item.name;
		result += line + "\n";
		if (item.children?.length) {
			result += generateTreeText(item.children, prefix + (isLast ? "    " : "|   "));
		}
	});
	return result;
}

// 过滤节点
function filterNodes(items: TreeNode[], filterMode: FilterMode, searchText: string): TreeNode[] {
	return items.map(item => {
		// 搜索模式
		if (filterMode === "search" && searchText) {
			const matches = item.name.toLowerCase().includes(searchText.toLowerCase());
			if (matches) return item;
			if (item.children) {
				const filtered = filterNodes(item.children, filterMode, searchText);
				if (filtered.length) return { ...item, children: filtered };
			}
			return null;
		}
		// 正常模式
		if (filterMode === "normal") {
			if (item.name.startsWith(".")) return null;
			if (DEFAULT_EXCLUDES.includes(item.name)) return null;
		}
		// 递归处理子节点
		if (item.children) {
			return { ...item, children: filterNodes(item.children, filterMode, searchText) };
		}
		return item;
	}).filter(Boolean) as TreeNode[];
}

export function TreeViewModal({
	isOpen, treeData, treeLoading, onClose, onFileClick,
}: TreeViewModalProps) {
	const [filterMode, setFilterMode] = useState<FilterMode>("normal");
	const [searchText, setSearchText] = useState("");
	const [copySuccess, setCopySuccess] = useState(false);
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

	// 初始化展开
	React.useEffect(() => {
		if (!treeData) return;
		const toExpand = new Set<string>();
		const collect = (items: TreeNode[], level: number) => {
			if (level >= 6) return;
			items.forEach(item => {
				if (item.isDirectory && item.children?.length) {
					toExpand.add(item.path);
					collect(item.children, level + 1);
				}
			});
		};
		collect(treeData.items, 0);
		setExpandedPaths(toExpand);
	}, [treeData]);

	const filteredItems = useMemo(() => {
		if (!treeData) return [];
		return filterNodes(treeData.items, filterMode, searchText);
	}, [treeData, filterMode, searchText]);

	const handleCopy = useCallback(async () => {
		if (!treeData) return;
		const text = treeData.path + "\n" + generateTreeText(filteredItems);
		try {
			await navigator.clipboard.writeText(text);
			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);
		} catch (err) {
			console.error("复制失败:", err);
		}
	}, [treeData, filteredItems]);

	const toggleExpand = useCallback((path: string) => {
		setExpandedPaths(prev => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}, []);

	if (!isOpen) return null;

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.container} onClick={e => e.stopPropagation()}>
				{/* 头部 */}
				<div className={styles.header}>
					<div className={styles.row1}>
						<span className={styles.title}>{treeData?.path || "."}</span>
						<button className={styles.closeBtn} onClick={onClose}>✕</button>
					</div>
					<div className={styles.row2}>
						<select
							className={styles.select}
							value={filterMode}
							onChange={e => {
								setFilterMode(e.target.value as FilterMode);
								if (e.target.value !== "search") setSearchText("");
							}}
						>
							<option value="normal">隐藏排除文件</option>
							<option value="all">显示所有</option>
							<option value="search">搜索...</option>
						</select>
						{filterMode === "search" && (
							<input
								className={styles.searchInput}
								placeholder="过滤..."
								value={searchText}
								onChange={e => setSearchText(e.target.value)}
								autoFocus
							/>
						)}
						<button 
							className={`${styles.copyBtn} ${copySuccess ? styles.success : ""}`}
							onClick={handleCopy}
							disabled={!filteredItems.length}
						>
							{copySuccess ? "✓ 已复制" : "📋 复制"}
						</button>
					</div>
				</div>

				{/* 树内容 */}
				<div className={styles.content}>
					{treeLoading ? (
						<div className={styles.loading}>Loading...</div>
					) : (
						<TreeLines
							items={filteredItems}
							expandedPaths={expandedPaths}
							onToggle={toggleExpand}
							onClick={onFileClick}
							searchText={searchText}
						/>
					)}
				</div>
			</div>
		</div>
	);
}

// 树行组件
interface TreeLinesProps {
	items: TreeNode[];
	expandedPaths: Set<string>;
	onToggle: (path: string) => void;
	onClick: (path: string, name: string) => void;
	searchText: string;
	prefix?: string;
}

function TreeLines({ items, expandedPaths, onToggle, onClick, searchText, prefix = "" }: TreeLinesProps) {
	if (!items.length) return null;
	
	return (
		<>
			{items.map((item, idx) => {
				const isLast = idx === items.length - 1;
				const connector = isLast ? "`-- " : "|-- ";
				const isExpanded = expandedPaths.has(item.path);
				const hasChildren = item.children?.length > 0;
				const icon = getFileIcon(item.name, item.isDirectory);
				const childPrefix = prefix + (isLast ? "    " : "|   ");
				
				// 高亮搜索文本
				let displayName = item.name;
				if (searchText) {
					const parts = item.name.split(new RegExp(`(${searchText})`, "gi"));
					displayName = parts.map((p, i) => 
						p.toLowerCase() === searchText.toLowerCase() ? 
							`<mark>${p}</mark>` : p
					).join("");
				}
				
				const lineText = prefix + connector + icon + " " + item.name;
				
				return (
					<React.Fragment key={item.path}>
						<div 
							className={styles.line}
							onClick={() => {
								if (hasChildren) onToggle(item.path);
								else onClick(item.path, item.name);
							}}
							dangerouslySetInnerHTML={{
								__html: prefix + 
									connector + 
									(hasChildren ? (isExpanded ? "[-] " : "[+] ") : "    ") +
									icon + " " +
									(searchText ? 
										item.name.replace(
											new RegExp(`(${searchText})`, "gi"), 
											'<mark class="' + styles.highlight + '">$1</mark>'
										) : 
										item.name
									)
							}}
						/>
						{isExpanded && hasChildren && (
							<TreeLines
								items={item.children}
								expandedPaths={expandedPaths}
								onToggle={onToggle}
								onClick={onClick}
								searchText={searchText}
								prefix={childPrefix}
							/>
							)}
						</React.Fragment>
					);
				})}
			</>
		);
}
