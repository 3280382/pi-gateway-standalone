/**
 * TreeViewModal - 紧凑全屏树状目录浏览模态窗口
 *
 * 特性：
 * - 全屏显示（宽高 100%）
 * - ASCII 树状格式显示层级（类似 tree 命令）
 * - 紧凑布局（无空隙，小字体）
 * - 过滤功能（隐藏文件、特定目录、搜索）
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

// 默认排除的目录/文件模式
const DEFAULT_EXCLUDES = [
	"node_modules",
	"__pycache__",
	".git",
	".svn",
	".hg",
	"dist",
	"build",
	".next",
	".nuxt",
	"coverage",
	".coverage",
	".idea",
	".vscode",
];

type FilterMode = "normal" | "all" | "search";

// 获取文件图标
function getFileIcon(name: string, isDirectory: boolean): string {
	if (isDirectory) return "📁";
	
	const ext = name.split(".").pop()?.toLowerCase() || "";
	
	const codeExts: Record<string, string> = {
		js: "📜", ts: "📘", jsx: "⚛️", tsx: "⚛️", py: "🐍", java: "☕",
		go: "🔵", rs: "🦀", c: "🔧", cpp: "🔧", h: "📋", hpp: "📋",
		cs: "🔷", php: "🐘", rb: "💎", swift: "🐦", kotlin: "🅺",
		scala: "🔴", lua: "🌙", sh: "🐚", bash: "🐚", zsh: "🐚",
		ps1: "💻", bat: "🖥️", cmd: "🖥️",
	};
	
	const markupExts: Record<string, string> = {
		html: "🌐", htm: "🌐", xml: "📰", json: "📋", yaml: "📋",
		yml: "📋", toml: "⚙️", ini: "⚙️", cfg: "⚙️", conf: "⚙️",
		md: "📝", markdown: "📝",
	};
	
	const styleExts: Record<string, string> = {
		css: "🎨", scss: "🎨", sass: "🎨", less: "🎨", styl: "🎨",
	};
	
	const imageExts: Record<string, string> = {
		png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", svg: "🎨",
		webp: "🖼️", ico: "🎯", bmp: "🖼️", tiff: "🖼️",
	};
	
	const docExts: Record<string, string> = {
		txt: "📄", doc: "📘", docx: "📘", pdf: "📕", xls: "📊",
		xlsx: "📊", ppt: "📽️", pptx: "📽️", rtf: "📄",
	};
	
	const archiveExts: Record<string, string> = {
		zip: "📦", rar: "📦", "7z": "📦", tar: "📦", gz: "📦", bz2: "📦", xz: "📦",
	};
	
	if (codeExts[ext]) return codeExts[ext];
	if (markupExts[ext]) return markupExts[ext];
	if (styleExts[ext]) return styleExts[ext];
	if (imageExts[ext]) return imageExts[ext];
	if (docExts[ext]) return docExts[ext];
	if (archiveExts[ext]) return archiveExts[ext];
	
	return "📄";
}

// 生成树状文本（用于复制）
function generateTreeText(items: TreeNode[], prefix = ""): string {
	let result = "";
	items.forEach((item, index) => {
		const isLast = index === items.length - 1;
		const connector = isLast ? "`-- " : "|-- ";
		const childPrefix = isLast ? "    " : "|   ";
		const icon = getFileIcon(item.name, item.isDirectory);
		
		result += prefix + connector + icon + " " + item.name + "\n";
		
		if (item.children && item.children.length > 0) {
			result += generateTreeText(item.children, prefix + childPrefix);
		}
	});
	return result;
}

export function TreeViewModal({
	isOpen,
	treeData,
	treeLoading,
	onClose,
	onFileClick,
}: TreeViewModalProps) {
	const [filterMode, setFilterMode] = useState<FilterMode>("normal");
	const [searchText, setSearchText] = useState("");
	const [copySuccess, setCopySuccess] = useState(false);
	// 控制哪些路径是展开的 - 默认展开前6层
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

	// 初始化展开前6层的节点
	React.useEffect(() => {
		if (!treeData) return;
		
		const pathsToExpand = new Set<string>();
		
		function collectPathsToExpand(items: TreeNode[], level: number) {
			if (level >= 6) return;
			items.forEach(item => {
				if (item.isDirectory && item.children) {
					pathsToExpand.add(item.path);
					collectPathsToExpand(item.children, level + 1);
				}
			});
		}
		
		collectPathsToExpand(treeData.items, 0);
		setExpandedPaths(pathsToExpand);
	}, [treeData]);

	// 过滤节点
	const filterNode = useCallback((node: TreeNode): TreeNode | null => {
		if (filterMode === "search" && searchText) {
			const matches = node.name.toLowerCase().includes(searchText.toLowerCase());
			if (matches) return node;
			if (node.children) {
				const filteredChildren = node.children
					.map(filterNode)
					.filter(Boolean) as TreeNode[];
				if (filteredChildren.length > 0) {
					return { ...node, children: filteredChildren };
				}
			}
			return null;
		}

		if (filterMode === "normal") {
			if (node.name.startsWith(".")) return null;
			if (DEFAULT_EXCLUDES.includes(node.name)) return null;
		}

		if (node.children) {
			const filteredChildren = node.children
				.map(filterNode)
				.filter(Boolean) as TreeNode[];
			return { ...node, children: filteredChildren };
		}

		return node;
	}, [filterMode, searchText]);

	const filteredData = useMemo(() => {
		if (!treeData) return null;
		const filteredItems = treeData.items
			.map(filterNode)
			.filter(Boolean) as TreeNode[];
		return { ...treeData, items: filteredItems };
	}, [treeData, filterNode]);

	const handleToggleExpand = useCallback((path: string) => {
		setExpandedPaths(prev => {
			const newSet = new Set(prev);
			if (newSet.has(path)) {
				newSet.delete(path);
			} else {
				newSet.add(path);
			}
			return newSet;
		});
	}, []);

	const handleCopyTree = useCallback(async () => {
		if (!filteredData) return;
		const treeText = filteredData.path + "\n" + generateTreeText(filteredData.items);
		try {
			await navigator.clipboard.writeText(treeText);
			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);
		} catch (err) {
			console.error("复制失败:", err);
		}
	}, [filteredData]);

	if (!isOpen) return null;

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.container} onClick={(e) => e.stopPropagation()}>
				{/* 头部 */}
				<div className={styles.header}>
					{/* 第1行：路径和关闭按钮 */}
					<div className={styles.headerRow}>
						<div className={styles.pathSection}>
							<TreeIcon />
							<span className={styles.path}>{treeData?.path || "."}</span>
						</div>
						<button className={styles.closeBtn} onClick={onClose} title="Close (ESC)">
							<CloseIcon />
						</button>
					</div>
					
					{/* 第2行：过滤控制和复制按钮 */}
					<div className={styles.headerRow}>
						<div className={styles.filterControls}>
							<select
								className={styles.select}
								value={filterMode}
								onChange={(e) => {
									setFilterMode(e.target.value as FilterMode);
									if (e.target.value !== "search") {
										setSearchText("");
									}
								}}
							>
								<option value="normal">隐藏排除文件</option>
								<option value="all">显示所有</option>
								<option value="search">搜索过滤...</option>
							</select>
							{filterMode === "search" && (
								<input
									type="text"
									className={styles.searchInput}
									placeholder="输入过滤文字..."
									value={searchText}
									onChange={(e) => setSearchText(e.target.value)}
									autoFocus
								/>
							)}
						</div>
						<button 
							className={`${styles.copyBtn} ${copySuccess ? styles.copySuccess : ""}`}
							onClick={handleCopyTree}
							title="复制树状文本"
							disabled={!filteredData || filteredData.items.length === 0}
						>
							{copySuccess ? "✓ 已复制" : "📋 复制"}
						</button>
					</div>
				</div>

				{/* 内容区 - ASCII 树 */}
				<div className={styles.content}>
					{treeLoading ? (
						<div className={styles.loading}>Loading...</div>
					) : filteredData ? (
						<AsciiTree
							items={filteredData.items}
							expandedPaths={expandedPaths}
							onToggleExpand={handleToggleExpand}
							onFileClick={onFileClick}
							filterMode={filterMode}
							searchText={searchText}
						/>
					) : (
						<div className={styles.empty}>Failed to load directory tree</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ASCII 树组件
interface AsciiTreeProps {
	items: TreeNode[];
	expandedPaths: Set<string>;
	onToggleExpand: (path: string) => void;
	onFileClick: (path: string, name: string) => void;
	filterMode: FilterMode;
	searchText: string;
	prefix?: string;
}

function AsciiTree({ 
	items, 
	expandedPaths, 
	onToggleExpand, 
	onFileClick,
	filterMode,
	searchText,
	prefix = ""
}: AsciiTreeProps) {
	if (!items || items.length === 0) return null;

	return (
		<div className={styles.treeList}>
			{items.map((item, index) => (
				<TreeLine
					key={item.path}
					item={item}
					index={index}
					total={items.length}
					prefix={prefix}
					expandedPaths={expandedPaths}
					onToggleExpand={onToggleExpand}
					onFileClick={onFileClick}
					filterMode={filterMode}
					searchText={searchText}
				/>
			))}
		</div>
	);
}

// 单行树节点
interface TreeLineProps {
	item: TreeNode;
	index: number;
	total: number;
	prefix: string;
	expandedPaths: Set<string>;
	onToggleExpand: (path: string) => void;
	onFileClick: (path: string, name: string) => void;
	filterMode: FilterMode;
	searchText: string;
}

function TreeLine({ 
	item, 
	index, 
	total, 
	prefix,
	expandedPaths,
	onToggleExpand,
	onFileClick,
	filterMode,
	searchText
}: TreeLineProps) {
	const isLast = index === total - 1;
	const connector = isLast ? "`-- " : "|-- ";
	const hasChildren = item.children && item.children.length > 0;
	const isExpanded = expandedPaths.has(item.path);
	const icon = getFileIcon(item.name, item.isDirectory);

	const handleClick = () => {
		if (item.isDirectory && hasChildren) {
			onToggleExpand(item.path);
		} else if (!item.isDirectory) {
			onFileClick(item.path, item.name);
		}
	};

	const highlightMatch = (text: string) => {
		if (filterMode !== "search" || !searchText) return text;
		const parts = text.split(new RegExp(`(${searchText})`, "gi"));
		return parts.map((part, i) =>
			part.toLowerCase() === searchText.toLowerCase() ? (
				<span key={i} className={styles.highlight}>{part}</span>
			) : part
		);
	};

	// 使用固定4字符宽度确保对齐：空格或 "|   "
	const childPrefix = prefix + (isLast ? "    " : "|   ");

	return (
		<>
			<div className={styles.treeLine} onClick={handleClick}>
				{/* 缩进前缀 */}
				<span className={styles.indent}>{prefix}</span>
				{/* 连接符 */}
				<span className={styles.connector}>{connector}</span>
				{/* 展开图标（仅目录） */}
				{hasChildren ? (
					<span className={styles.expandIcon}>{isExpanded ? "[-]" : "[+]"}</span>
				) : (
					<span className={styles.expandIconPlaceholder}>   </span>
				)}
				{/* 文件图标 */}
				<span className={styles.icon}>{icon}</span>
				{/* 文件名 */}
				<span className={item.isDirectory ? styles.dirName : styles.fileName}>
					{highlightMatch(item.name)}
				</span>
			</div>
			{isExpanded && hasChildren && (
				<AsciiTree
					items={item.children!}
					expandedPaths={expandedPaths}
					onToggleExpand={onToggleExpand}
					onFileClick={onFileClick}
					filterMode={filterMode}
					searchText={searchText}
					prefix={childPrefix}
				/>
			)}
		</>
	);
}

// Icons
function TreeIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14">
			<path d="M12 3v18M12 8l-4-4M12 8l4-4M8 12H4m16 0h-4M8 16H4m16 0h-4M8 20H4m16 0h-4" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="16" height="16">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
