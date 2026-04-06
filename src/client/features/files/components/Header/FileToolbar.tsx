import React, { useEffect, useRef, useState } from "react";
/**
 * FileToolbar - 文件浏览器工具栏（两行布局）
 */
import {
	type FilterType,
	type SortMode,
	useFileStore,
} from "@/features/files/stores/fileStore";
import { useFileNavigation } from "@/features/files/hooks";
import styles from "../FileBrowser/FileBrowser.module.css";

// 可执行文件扩展名
const EXECUTABLE_EXTENSIONS = [
	"sh",
	"bash",
	"zsh",
	"py",
	"js",
	"ts",
	"pl",
	"rb",
];

// 过滤选项定义
const FILTER_OPTIONS: { value: FilterType; icon: string; label: string }[] = [
	{ value: "all", icon: "📁", label: "All Files" },
	{ value: "dir", icon: "📂", label: "Directories" },
	{ value: "text", icon: "📄", label: "Text Files" },
	{ value: "html", icon: "🌐", label: "HTML/CSS" },
	{ value: "js", icon: "📜", label: "JavaScript/TS" },
	{ value: "py", icon: "🐍", label: "Python" },
	{ value: "sh", icon: "⚡", label: "Shell Scripts" },
	{ value: "java", icon: "☕", label: "Java" },
	{ value: "json", icon: "📋", label: "JSON/Data" },
	{ value: "md", icon: "📝", label: "Markdown" },
	{ value: "image", icon: "🖼️", label: "Images" },
	{ value: "code", icon: "💻", label: "All Code" },
];

// 排序选项定义
const SORT_OPTIONS: { value: SortMode; icon: string; label: string }[] = [
	{ value: "time-desc", icon: "🕐", label: "Time ↓" },
	{ value: "time-asc", icon: "🕐", label: "Time ↑" },
	{ value: "name-asc", icon: "🔤", label: "Name A-Z" },
	{ value: "name-desc", icon: "🔤", label: "Name Z-A" },
	{ value: "size-desc", icon: "📊", label: "Size ↓" },
	{ value: "size-asc", icon: "📊", label: "Size ↑" },
	{ value: "type", icon: "📎", label: "Type" },
];

interface FileToolbarProps {
	currentPath: string;
	onRefresh: () => void;
	onToggleSidebar?: () => void;
	onExecuteOutput?: (output: string) => void;
	onOpenBottomPanel?: (output: string) => void;
}

export function FileToolbar({
	currentPath,
	onRefresh,
	onToggleSidebar,
	onExecuteOutput,
	onOpenBottomPanel,
}: FileToolbarProps) {
	const {
		viewMode,
		sortMode,
		filterType,
		filterText,
		selectedActionFileName,
		toggleViewMode,
		setSortMode,
		setFilterType,
		setFilterText,
		toggleSidebar: storeToggleSidebar,
	} = useFileStore();

	const { navigateUp, navigateHome, canNavigateUp } = useFileNavigation();

	// 过滤下拉框状态
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// 排序下拉框状态
	const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
	const sortDropdownRef = useRef<HTMLDivElement>(null);

	// 点击外部关闭下拉框
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsDropdownOpen(false);
			}
			if (
				sortDropdownRef.current &&
				!sortDropdownRef.current.contains(event.target as Node)
			) {
				setIsSortDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// 获取当前选中的选项
	const selectedOption =
		FILTER_OPTIONS.find((opt) => opt.value === filterType) || FILTER_OPTIONS[0];

	// 处理选项选择
	const handleSelect = (value: FilterType) => {
		setFilterType(value);
		if (value !== "custom") {
			setFilterText("");
		}
		setIsDropdownOpen(false);
	};

	// 处理输入框变化
	const handleInputChange = (value: string) => {
		const option = FILTER_OPTIONS.find(
			(opt) => opt.label.toLowerCase() === value.toLowerCase(),
		);
		if (option) {
			setFilterType(option.value);
			setFilterText("");
		} else {
			setFilterType("custom");
			setFilterText(value);
		}
	};

	// 检查选中的文件是否可执行
	const isExecutable = selectedActionFileName
		? EXECUTABLE_EXTENSIONS.some((ext) =>
				selectedActionFileName.toLowerCase().endsWith("." + ext),
			) || !selectedActionFileName.includes(".")
		: false;

	return (
		<div className={styles.toolbarWrapper}>
			{/* 第一行：导航 + 路径 + 执行 */}
			<div className={styles.toolbarRow}>
				{/* 导航按钮 */}
				<button
					className={styles.toolbarBtn}
					onClick={navigateHome}
					title="Go Home"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
						<polyline points="9 22 9 12 15 12 15 22" />
					</svg>
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={onRefresh}
					title="Refresh"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
					>
						<polyline points="23 4 23 10 17 10" />
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
					</svg>
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={navigateUp}
					disabled={!canNavigateUp}
					title="Go Up"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path d="M12 19V5M5 12l7-7 7 7" />
					</svg>
				</button>
				{/* 路径栏 */}
				<div className={styles.pathBar}>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
					</svg>
					<span>{currentPath}</span>
				</div>
			</div>
			{/* 第二行：过滤 + 视图选项 */}
			<div className={styles.toolbarRow}>
				{/* 合并过滤组件：可输入+可下拉选择 */}
				<div className={styles.filterCombo} ref={dropdownRef}>
					<input
						type="text"
						className={styles.filterComboInput}
						placeholder="Filter or select type..."
						value={filterType === "custom" ? filterText : selectedOption.label}
						onChange={(e) => handleInputChange(e.target.value)}
						onClick={() => setIsDropdownOpen(true)}
					/>
					<button
						className={styles.filterComboBtn}
						onClick={() => setIsDropdownOpen(!isDropdownOpen)}
						title="Select filter type"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>
					{/* 自定义下拉菜单 */}
					{isDropdownOpen && (
						<div className={styles.filterDropdown}>
							{FILTER_OPTIONS.map((option) => (
								<div
									key={option.value}
									className={`${styles.filterDropdownItem} ${filterType === option.value ? styles.active : ""}`}
									onClick={() => handleSelect(option.value)}
								>
									<span className={styles.filterIcon}>{option.icon}</span>
									<span className={styles.filterLabel}>{option.label}</span>
								</div>
							))}
						</div>
					)}
				</div>
				{/* 排序选择 - 自定义下拉框 */}
				<div className={styles.sortCombo} ref={sortDropdownRef}>
					<button
						className={styles.sortComboBtn}
						onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
						title="Sort by"
					>
						<span>
							{SORT_OPTIONS.find((opt) => opt.value === sortMode)?.icon}
						</span>
						<span>
							{SORT_OPTIONS.find((opt) => opt.value === sortMode)?.label}
						</span>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>
					{/* 自定义排序下拉菜单 */}
					{isSortDropdownOpen && (
						<div className={styles.sortDropdown}>
							{SORT_OPTIONS.map((option) => (
								<div
									key={option.value}
									className={`${styles.sortDropdownItem} ${sortMode === option.value ? styles.active : ""}`}
									onClick={() => {
										setSortMode(option.value);
										setIsSortDropdownOpen(false);
									}}
								>
									<span className={styles.sortIcon}>{option.icon}</span>
									<span className={styles.sortLabel}>{option.label}</span>
								</div>
							))}
						</div>
					)}
				</div>
				{/* 视图切换 - 仅图标 */}
				<button
					className={`${styles.toolbarBtn} ${styles.iconBtn}`}
					onClick={toggleViewMode}
					title={
						viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"
					}
				>
					{viewMode === "grid" ? (
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
						>
							<line x1="8" y1="6" x2="21" y2="6" />
							<line x1="8" y1="12" x2="21" y2="12" />
							<line x1="8" y1="18" x2="21" y2="18" />
							<line x1="3" y1="6" x2="3.01" y2="6" />
							<line x1="3" y1="12" x2="3.01" y2="12" />
							<line x1="3" y1="18" x2="3.01" y2="18" />
						</svg>
					) : (
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
						>
							<rect x="3" y="3" width="7" height="7" />
							<rect x="14" y="3" width="7" height="7" />
							<rect x="14" y="14" width="7" height="7" />
							<rect x="3" y="14" width="7" height="7" />
						</svg>
					)}
				</button>
			</div>
		</div>
	);
}
