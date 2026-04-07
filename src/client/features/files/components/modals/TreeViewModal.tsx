/**
 * TreeViewModal - 紧凑全屏树状目录浏览模态窗口
 *
 * 特性：
 * - 全屏显示（宽高 100%）
 * - 制表符层级缩进
 * - 紧凑布局（无空隙，小字体）
 * - 过滤功能（隐藏文件、特定目录、搜索）
 * - 不同文件类型不同图标
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
	
	// 代码文件
	const codeExts: Record<string, string> = {
		js: "📜",
		ts: "📘",
		jsx: "⚛️",
		tsx: "⚛️",
		py: "🐍",
		java: "☕",
		go: "🔵",
		rs: "🦀",
		c: "🔧",
		cpp: "🔧",
		h: "📋",
		hpp: "📋",
		cs: "🔷",
		php: "🐘",
		rb: "💎",
		swift: "🐦",
		kotlin: "🅺",
		scala: "🔴",
		rust: "🦀",
		lua: "🌙",
		sh: "🐚",
		bash: "🐚",
		zsh: "🐚",
		ps1: "💻",
		bat: "🖥️",
		cmd: "🖥️",
	};
	
	// 标记语言/配置
	const markupExts: Record<string, string> = {
		html: "🌐",
		htm: "🌐",
		xml: "📰",
		json: "📋",
		yaml: "📋",
		yml: "📋",
		toml: "⚙️",
		ini: "⚙️",
		cfg: "⚙️",
		conf: "⚙️",
		md: "📝",
		markdown: "📝",
	};
	
	// 样式文件
	const styleExts: Record<string, string> = {
		css: "🎨",
		scss: "🎨",
		sass: "🎨",
		less: "🎨",
		styl: "🎨",
	};
	
	// 图片文件
	const imageExts: Record<string, string> = {
		png: "🖼️",
		jpg: "🖼️",
		jpeg: "🖼️",
		gif: "🖼️",
		svg: "🎨",
		webp: "🖼️",
		ico: "🎯",
		bmp: "🖼️",
		tiff: "🖼️",
	};
	
	// 文档文件
	const docExts: Record<string, string> = {
		txt: "📄",
		doc: "📘",
		docx: "📘",
		pdf: "📕",
		xls: "📊",
		xlsx: "📊",
		ppt: "📽️",
		pptx: "📽️",
		rtf: "📄",
	};
	
	// 数据文件
	const dataExts: Record<string, string> = {
		sql: "🗃️",
		csv: "📊",
		tsv: "📊",
	};
	
	// 压缩文件
	const archiveExts: Record<string, string> = {
		zip: "📦",
		rar: "📦",
		7z: "📦",
		tar: "📦",
		gz: "📦",
		bz2: "📦",
		xz: "📦",
	};
	
	// 可执行文件
	const execExts: Record<string, string> = {
		exe: "⚙️",
		msi: "⚙️",
		dmg: "🍎",
		app: "🍎",
		deb: "📦",
		rpm: "📦",
		snap: "📦",
		flatpak: "📦",
	};
	
	// 字体文件
	const fontExts: Record<string, string> = {
		ttf: "🔤",
		otf: "🔤",
		woff: "🔤",
		woff2: "🔤",
		eot: "🔤",
	};
	
	// 媒体文件
	const mediaExts: Record<string, string> = {
		mp3: "🎵",
		wav: "🎵",
		ogg: "🎵",
		flac: "🎵",
		aac: "🎵",
		mp4: "🎬",
		avi: "🎬",
		mkv: "🎬",
		mov: "🎬",
		wmv: "🎬",
		flv: "🎬",
		webm: "🎬",
	};
	
	if (codeExts[ext]) return codeExts[ext];
	if (markupExts[ext]) return markupExts[ext];
	if (styleExts[ext]) return styleExts[ext];
	if (imageExts[ext]) return imageExts[ext];
	if (docExts[ext]) return docExts[ext];
	if (dataExts[ext]) return dataExts[ext];
	if (archiveExts[ext]) return archiveExts[ext];
	if (execExts[ext]) return execExts[ext];
	if (fontExts[ext]) return fontExts[ext];
	if (mediaExts[ext]) return mediaExts[ext];
	
	return "📄"; // 默认文件图标
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

	// 过滤节点
	const filterNode = useCallback((node: TreeNode): TreeNode | null => {
		// 搜索模式
		if (filterMode === "search" && searchText) {
			const matches = node.name.toLowerCase().includes(searchText.toLowerCase());
			if (matches) return node;
			// 如果子节点匹配，保留当前节点
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

		// 正常模式（不显示隐藏文件和排除目录）
		if (filterMode === "normal") {
			// 隐藏文件（以 . 开头）
			if (node.name.startsWith(".")) return null;
			// 排除的目录
			if (DEFAULT_EXCLUDES.includes(node.name)) return null;
		}

		// 递归过滤子节点
		if (node.children) {
			const filteredChildren = node.children
				.map(filterNode)
				.filter(Boolean) as TreeNode[];
			return { ...node, children: filteredChildren };
		}

		return node;
	}, [filterMode, searchText]);

	// 过滤后的数据
	const filteredData = useMemo(() => {
		if (!treeData) return null;
		const filteredItems = treeData.items
			.map(filterNode)
			.filter(Boolean) as TreeNode[];
		return { ...treeData, items: filteredItems };
	}, [treeData, filterNode]);

	if (!isOpen) return null;

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.container} onClick={(e) => e.stopPropagation()}>
				{/* 头部工具栏 - 两行布局 */}
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
					
					{/* 第2行：过滤控制 */}
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
					</div>
				</div>

				{/* 内容区 */}
				<div className={styles.content}>
					{treeLoading ? (
						<div className={styles.loading}>Loading...</div>
					) : filteredData ? (
						<TreeNodeList
							items={filteredData.items}
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

// Tree Node List Component
interface TreeNodeListProps {
	items: TreeNode[];
	onFileClick: (path: string, name: string) => void;
	level?: number;
	filterMode: FilterMode;
	searchText: string;
}

function TreeNodeList({ items, onFileClick, level = 0, filterMode, searchText }: TreeNodeListProps) {
	if (!items || items.length === 0) return null;

	return (
		<>
			{items.map((item) => (
				<TreeNodeItem
					key={item.path}
					item={item}
					level={level}
					onFileClick={onFileClick}
					filterMode={filterMode}
					searchText={searchText}
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
	filterMode: FilterMode;
	searchText: string;
}

function TreeNodeItem({ item, level, onFileClick, filterMode, searchText }: TreeNodeItemProps) {
	// 前6层默认展开
	const [expanded, setExpanded] = useState(level < 6);
	const hasChildren = item.children && item.children.length > 0;

	const handleClick = () => {
		if (item.isDirectory && hasChildren) {
			setExpanded(!expanded);
		} else if (!item.isDirectory) {
			onFileClick(item.path, item.name);
		}
	};

	// 高亮匹配文本
	const highlightMatch = (text: string) => {
		if (filterMode !== "search" || !searchText) return text;
		const parts = text.split(new RegExp(`(${searchText})`, "gi"));
		return parts.map((part, i) =>
			part.toLowerCase() === searchText.toLowerCase() ? (
				<span key={i} className={styles.highlight}>{part}</span>
			) : (
				part
			)
		);
	};

	const icon = getFileIcon(item.name, item.isDirectory);

	return (
		<div className={styles.node}>
			<div
				className={styles.nodeHeader}
				style={{ paddingLeft: `${level * 20}px` }}
				onClick={handleClick}
			>
				{hasChildren ? (
					<span className={styles.expandIcon}>{expanded ? "▼" : "▶"}</span>
				) : (
					<span className={styles.expandIconPlaceholder} />
				)}
				<span className={styles.icon}>{icon}</span>
				<span className={item.isDirectory ? styles.dirName : styles.fileName}>
					{highlightMatch(item.name)}
				</span>
			</div>
			{expanded && hasChildren && (
				<TreeNodeList
					items={item.children!}
					level={level + 1}
					onFileClick={onFileClick}
					filterMode={filterMode}
					searchText={searchText}
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
			width="14"
			height="14"
		>
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
