/**
 * AppHeader - Two Row Layout
 * Row 1: System Prompt, Model Selector, Thinking Mode, Connection Status
 * Row 2: Working Directory + Search & Filter
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SystemPromptModal } from "@/features/chat/components/modals/SystemPromptModal";
import { chatController } from "@/features/chat/controllers";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import {
	selectSearchFilters,
	selectSearchQuery,
	useChatStore,
} from "@/features/chat/stores/chatStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import {
	getSystemPrompt,
	type SystemPromptResponse,
} from "@/shared/services/api/systemPromptApi";
import { websocketService } from "@/shared/services/websocket.service";
import { useSessionStore } from "@/shared/stores/sessionStore";
import styles from "./AppHeader.module.css";

// DirectoryPicker component for selecting working directory
function DirectoryPicker({
	currentPath,
	onSelect,
	onClose,
}: {
	currentPath: string;
	onSelect: (path: string) => void;
	onClose: () => void;
}) {
	const [path, setPath] = useState(currentPath);
	const [entries, setEntries] = useState<
		Array<{ name: string; path: string; isDirectory: boolean }>
	>([]);
	const [loading, setLoading] = useState(false);

	const loadDirectory = async (dirPath: string) => {
		setLoading(true);
		try {
			console.log("[DirectoryPicker] Loading directory:", dirPath);
			const response = await fetch("/api/browse", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: dirPath }),
			});
			const data = await response.json();
			console.log("[DirectoryPicker] Browse result:", {
				currentPath: data.currentPath,
				parentPath: data.parentPath,
			});

			const dirs = data.items
				.filter((item: any) => item.isDirectory)
				.map((item: any) => ({
					name: item.name,
					path: item.path,
					isDirectory: true,
				}));

			if (data.parentPath !== data.currentPath) {
				dirs.unshift({
					name: "..",
					path: data.parentPath,
					isDirectory: true,
				});
			}

			setEntries(dirs);
			setPath(data.currentPath);
		} catch (error) {
			console.error("Failed to load directory:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadDirectory(currentPath);
	}, [currentPath]);

	return (
		<div className={styles.pickerOverlay} onClick={onClose}>
			<div className={styles.picker} onClick={(e) => e.stopPropagation()}>
				<div className={styles.pickerHeader}>
					<h4>Select Working Directory</h4>
					<button className={styles.closeBtn} onClick={onClose}>
						✕
					</button>
				</div>
				<div className={styles.currentPath}>{path}</div>
				<div className={styles.pickerActions}>
					<button className={styles.selectBtn} onClick={() => onSelect(path)}>
						Select This Directory
					</button>
				</div>
				<div className={styles.entriesList}>
					{loading ? (
						<div className={styles.pickerLoading}>Loading...</div>
					) : (
						entries.map((entry) => (
							<div
								key={entry.path}
								className={styles.entry}
								onClick={() => loadDirectory(entry.path)}
							>
								<FolderIcon className={styles.entryIcon} />
								<span className={styles.entryName}>{entry.name}</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

// Thinking levels - must match backend enum: ["off", "minimal", "low", "medium", "high", "xhigh"]
const THINKING_LEVELS = [
	{ id: "off", name: "None", icon: "○" },
	{ id: "minimal", name: "Low", icon: "◐" },
	{ id: "low", name: "Med", icon: "◑" },
	{ id: "medium", name: "High", icon: "◒" },
	{ id: "high", name: "XHigh", icon: "●" },
] as const;

interface AppHeaderProps {
	currentView?: "chat" | "files";
	searchQuery?: string;
	searchFilters?: {
		user: boolean;
		assistant: boolean;
		thinking: boolean;
		tools: boolean;
	};
	onSearchQueryChange?: (query: string) => void;
	onSearchFiltersChange?: (filters: {
		user: boolean;
		assistant: boolean;
		thinking: boolean;
		tools: boolean;
	}) => void;
}

// DEBUG: Check if new code is loaded
console.log("[AppHeader] Module loaded, version: 2024-01-15-001");

export function AppHeader({
	currentView = "chat",
	searchQuery: externalSearchQuery,
	searchFilters: externalSearchFilters,
	onSearchQueryChange,
	onSearchFiltersChange,
}: AppHeaderProps) {
	// Log props on every render
	console.log("[AppHeader] Render props:", {
		onSearchQueryChange: typeof onSearchQueryChange,
		onSearchFiltersChange: typeof onSearchFiltersChange,
		externalSearchQuery: externalSearchQuery?.slice?.(0, 20),
	});
	const {
		currentModel,
		thinkingLevel,
		setThinkingLevel,
		setCurrentModel,
		serverPid,
		currentDir,
		isConnected,
	} = useSessionStore();

	// 从 store 获取数据
	const workingDir = currentDir;
	const connectionStatus = isConnected ? "connected" : "disconnected";
	const pid = serverPid;
	const { isStreaming } = useChatStore();

	// Search state - 优先使用外部传入的 props，否则使用 chatStore
	const chatStoreQuery = useChatStore(selectSearchQuery);
	const chatStoreFilters = useChatStore(selectSearchFilters);
	const chatStoreSetSearchQuery = useChatStore((s) => s.setSearchQuery);
	const chatStoreSetSearchFilters = useChatStore((s) => s.setSearchFilters);

	const searchQuery = externalSearchQuery ?? chatStoreQuery;
	const filters = externalSearchFilters ?? chatStoreFilters;
	const sidebarController = useSidebarController();
	// System prompt state (now using modalStore)
	const openSystemPrompt = useModalStore((state) => state.openSystemPrompt);

	// Modal/dropdown states from modalStore
	const isDirectoryBrowserOpen = useModalStore(
		(state) => state.isDirectoryBrowserOpen,
	);
	const openDirectoryBrowser = useModalStore(
		(state) => state.openDirectoryBrowser,
	);
	const closeDirectoryBrowser = useModalStore(
		(state) => state.closeDirectoryBrowser,
	);

	// Filter panel state (kept local as it's inline panel, not modal)
	const [showFilters, setShowFilters] = useState(false);

	// Model dropdown state (kept local as it's a dropdown, not modal)
	const [showModelDropdown, setShowModelDropdown] = useState(false);
	const [models, setModels] = useState<
		Array<{ id: string; name: string; provider: string }>
	>([]);
	const [modelsLoading, setModelsLoading] = useState(false);

	// Thinking dropdown state (kept local as it's a dropdown, not modal)
	const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);

	const currentThinking =
		THINKING_LEVELS.find((t) => t.id === thinkingLevel) || THINKING_LEVELS[2];

	// Handle working directory selection
	const handleDirSelect = async (selectedPath: string) => {
		console.log(
			"[AppHeader] Directory selected:",
			selectedPath,
			"current:",
			workingDir,
		);
		closeDirectoryBrowser();
		if (selectedPath && selectedPath !== workingDir) {
			await sidebarController.changeWorkingDir(selectedPath);
		}
	};

	const handleFilterChange = (key: keyof typeof filters) => {
		console.log(
			"[AppHeader] Filter changed:",
			key,
			"onSearchFiltersChange exists:",
			!!onSearchFiltersChange,
		);
		if (onSearchFiltersChange) {
			// 使用外部传入的回调
			onSearchFiltersChange({ ...filters, [key]: !filters[key] });
		} else {
			// 使用 chatStore
			chatStoreSetSearchFilters({ [key]: !filters[key] });
		}
	};

	const hasActiveFilters =
		filters.user || filters.assistant || filters.thinking || filters.tools;
	const activeFilterCount = [
		filters.user,
		filters.assistant,
		filters.thinking,
		filters.tools,
	].filter(Boolean).length;

	// Load models when dropdown opens
	useEffect(() => {
		if (showModelDropdown && models.length === 0 && !modelsLoading) {
			setModelsLoading(true);
			fetch("/api/models")
				.then((r) => r.json())
				.then((data) => {
					setModels(data.models || []);
					setModelsLoading(false);
				})
				.catch(() => {
					setModelsLoading(false);
				});
		}
	}, [showModelDropdown, models.length, modelsLoading]);

	// Handle model selection
	const handleModelSelect = async (modelId: string) => {
		const model = models.find((m) => m.id === modelId);
		if (model) {
			console.log("[AppHeader] Switching model:", model);
			console.log("[AppHeader] model.id type:", typeof model.id, "value:", model.id);
			console.log("[AppHeader] model.provider type:", typeof model.provider, "value:", model.provider);
			try {
				// Use chatController to set model (sends to server and waits for confirmation)
				await chatController.setCurrentModel({ id: model.id, provider: model.provider });
				console.log("[AppHeader] Model set successfully");
			} catch (error) {
				console.error("[AppHeader] Failed to set model:", error);
			}
		}
		setShowModelDropdown(false);
	};

	// Handle thinking level selection
	const handleThinkingSelect = (level: string) => {
		console.log("[AppHeader] Switching thinking level:", level);
		// Send to server via WebSocket
		const sent = websocketService.send("thinking_level_change", {
			thinkingLevel: level,
		});
		console.log("[AppHeader] thinking_level_change message sent:", sent);
		// Update local state
		setThinkingLevel(level as any);
		setShowThinkingDropdown(false);
	};

	// Close dropdowns when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (
				!target.closest(`.${styles.modelDropdown}`) &&
				!target.closest(`.${styles.modelSelector}`)
			) {
				setShowModelDropdown(false);
			}
			if (
				!target.closest(`.${styles.thinkingDropdown}`) &&
				!target.closest(`.${styles.thinkingSelector}`)
			) {
				setShowThinkingDropdown(false);
			}
		};
		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, []);

	// Get current model display name
	const currentModelName = currentModel
		? models.find((m) => m.id === currentModel)?.name ||
			currentModel.split("-")[0]
		: "Select Model";

	// Format working directory for display (show last 2 parts)
	const formatWorkingDir = (path: string) => {
		if (!path) return "No workspace";
		const parts = path.split("/").filter(Boolean);
		if (parts.length <= 2) return path;
		return ".../" + parts.slice(-2).join("/");
	};

	// Files 视图：显示文件工具栏
	if (currentView === "files") {
		return (
			<FileToolbarAppHeader
				workingDir={workingDir}
				connectionStatus={connectionStatus}
				pid={pid}
			/>
		);
	}

	// Chat 视图：完整显示
	return (
		<div className={styles.topBar}>
			{/* Row 1: System Prompt, Model, Thinking, Status */}
			<div className={styles.topRow}>
				{/* Left: System Prompt */}
				<button
					className={styles.iconBtn}
					onClick={() => openSystemPrompt()}
					title="System Prompt"
				>
					<DocumentIcon />
				</button>

				{/* Model Selector */}
				<div className={styles.modelSelector}>
					<button
						className={styles.selector}
						onClick={() => setShowModelDropdown(!showModelDropdown)}
						disabled={isStreaming}
						title="Select Model"
					>
						<ModelIcon />
						<span className={styles.selectorText}>{currentModelName}</span>
						<DropdownIcon />
					</button>
					{showModelDropdown && (
						<div className={styles.modelDropdown}>
							{modelsLoading ? (
								<div className={styles.dropdownLoading}>Loading...</div>
							) : (
								models.map((m) => (
									<div
										key={m.id}
										className={`${styles.dropdownItem} ${m.id === currentModel ? styles.active : ""}`}
										onClick={() => handleModelSelect(m.id)}
									>
										<span className={styles.modelName}>{m.name}</span>
										<span className={styles.modelProvider}>{m.provider}</span>
									</div>
								))
							)}
						</div>
					)}
				</div>

				{/* Thinking Level Selector */}
				<div className={styles.thinkingSelector}>
					<button
						className={styles.selector}
						onClick={() => setShowThinkingDropdown(!showThinkingDropdown)}
						disabled={isStreaming}
						title="Thinking Level"
					>
						<ThinkingIcon />
						<span className={styles.selectorText}>
							{currentThinking.icon} {currentThinking.name}
						</span>
						<DropdownIcon />
					</button>
					{showThinkingDropdown && (
						<div className={styles.thinkingDropdown}>
							{THINKING_LEVELS.map((t) => (
								<div
									key={t.id}
									className={`${styles.dropdownItem} ${t.id === thinkingLevel ? styles.active : ""}`}
									onClick={() => handleThinkingSelect(t.id)}
								>
									<span className={styles.thinkingIcon}>{t.icon}</span>
									<span className={styles.thinkingName}>{t.name}</span>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Status: Circle icon + PID */}
				<div
					className={styles.status}
					title={`${connectionStatus}${pid ? ` (PID: ${pid})` : ""}`}
				>
					<span className={`${styles.statusDot} ${styles[connectionStatus]}`} />
					{(pid || serverPid) && (
						<span className={styles.pid}>{pid || serverPid}</span>
					)}
				</div>
			</div>

			{/* Row 2: Working Directory + Search */}
			<div className={styles.bottomRow}>
				{/* Left: Working Directory Button */}
				<button
					className={styles.workingDirBtn}
					onClick={() => openDirectoryBrowser()}
					title={`Working Directory: ${workingDir || "Click to select"}`}
				>
					<FolderIcon className={styles.btnIcon} />
					<span className={styles.workingDirBtnText}>
						{formatWorkingDir(workingDir)}
					</span>
				</button>

				{/* Right: Search */}
				<div className={styles.searchSection}>
					<div className={styles.searchWrapper}>
						<SearchIcon className={styles.searchIcon} />
						<input
							type="text"
							className={styles.searchInput}
							placeholder="Search messages..."
							value={searchQuery}
							onChange={(e) => {
								console.log(
									"[AppHeader] Input changed:",
									e.target.value,
									"onSearchQueryChange exists:",
									!!onSearchQueryChange,
								);
								if (onSearchQueryChange) {
									onSearchQueryChange(e.target.value);
								} else {
									chatStoreSetSearchQuery(e.target.value);
								}
							}}
						/>
						{searchQuery && (
							<button
								className={styles.clearBtn}
								onClick={() => {
									if (onSearchQueryChange) {
										onSearchQueryChange("");
									} else {
										chatStoreSetSearchQuery("");
									}
								}}
								title="Clear"
							>
								<XIcon />
							</button>
						)}
						<button
							className={`${styles.filterToggle} ${hasActiveFilters ? styles.active : ""} ${showFilters ? styles.expanded : ""}`}
							onClick={() => setShowFilters(!showFilters)}
							title="Toggle Filters"
						>
							<FilterIcon />
							{hasActiveFilters && (
								<span className={styles.filterCount}>{activeFilterCount}</span>
							)}
						</button>
					</div>

					{/* Filter dropdown */}
					{showFilters && (
						<div className={styles.filterDropdown}>
							<FilterChip
								label="User"
								checked={filters.user}
								onChange={() => handleFilterChange("user")}
							/>
							<FilterChip
								label="Assistant"
								checked={filters.assistant}
								onChange={() => handleFilterChange("assistant")}
							/>
							<FilterChip
								label="Thinking"
								checked={filters.thinking}
								onChange={() => handleFilterChange("thinking")}
							/>
							<FilterChip
								label="Tools"
								checked={filters.tools}
								onChange={() => handleFilterChange("tools")}
							/>
						</div>
					)}
				</div>
			</div>

			{/* System Prompt Modal - managed by modalStore */}
			<SystemPromptModal />

			{/* Directory Picker Modal */}
			{isDirectoryBrowserOpen && (
				<DirectoryPicker
					currentPath={workingDir || "/root"}
					onSelect={handleDirSelect}
					onClose={closeDirectoryBrowser}
				/>
			)}
		</div>
	);
}

// Filter Chip Component
function FilterChip({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: () => void;
}) {
	return (
		<button
			className={`${styles.filterChip} ${checked ? styles.checked : ""}`}
			onClick={onChange}
		>
			{checked && <CheckIcon />}
			<span>{label}</span>
		</button>
	);
}

// Icons - 所有图标都有固定尺寸
function DocumentIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
		</svg>
	);
}

function SearchIcon({ className }: { className?: string }) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			className={className}
		>
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	);
}

function XIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

function FilterIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

function ModelIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
		</svg>
	);
}

function ThinkingIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="16" x2="12" y2="12" />
			<line x1="12" y1="8" x2="12.01" y2="8" />
		</svg>
	);
}

function DropdownIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

function FolderIcon({ className }: { className?: string }) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
		</svg>
	);
}

// ============================================
// FileToolbarAppHeader - Files 视图的顶部工具栏
// ============================================
import {
	type FilterType,
	type SortMode,
	useFileStore,
} from "@/features/files/stores/fileStore";

const FILE_FILTER_OPTIONS: {
	value: FilterType;
	icon: string;
	label: string;
}[] = [
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

const FILE_SORT_OPTIONS: { value: SortMode; icon: string; label: string }[] = [
	{ value: "time-desc", icon: "🕐", label: "Time ↓" },
	{ value: "time-asc", icon: "🕐", label: "Time ↑" },
	{ value: "name-asc", icon: "🔤", label: "Name A-Z" },
	{ value: "name-desc", icon: "🔤", label: "Name Z-A" },
	{ value: "size-desc", icon: "📊", label: "Size ↓" },
	{ value: "size-asc", icon: "📊", label: "Size ↑" },
	{ value: "type", icon: "📎", label: "Type" },
];

interface FileToolbarAppHeaderProps {
	workingDir: string;
	connectionStatus: "connected" | "disconnected" | "connecting";
	pid: number | null;
}

function FileToolbarAppHeader({
	workingDir,
	connectionStatus,
	pid,
}: FileToolbarAppHeaderProps) {
	const fileStore = useFileStore();
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isSortOpen, setIsSortOpen] = useState(false);
	const filterRef = useRef<HTMLDivElement>(null);
	const sortRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
				setIsFilterOpen(false);
			}
			if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
				setIsSortOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const selectedFilter =
		FILE_FILTER_OPTIONS.find((opt) => opt.value === fileStore.filterType) ||
		FILE_FILTER_OPTIONS[0];

	return (
		<div className={styles.topBar}>
			{/* Row 1: 路径导航 */}
			<div className={styles.topRow}>
				<button
					className={styles.iconBtn}
					onClick={() => fileStore.navigateHome()}
					title="Home"
				>
					<svg
						width="16"
						height="16"
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
					className={styles.iconBtn}
					onClick={() => fileStore.setCurrentPath(fileStore.currentPath)}
					title="Refresh"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
					>
						<polyline points="23 4 23 10 17 10" />
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
					</svg>
				</button>
				<div className={styles.pathBar}>
					<FolderIcon className={styles.btnIcon} />
					<span>{fileStore.currentPath}</span>
				</div>
				<div className={styles.spacer} />
				<div
					className={styles.status}
					title={`${connectionStatus}${pid ? ` (PID: ${pid})` : ""}`}
				>
					<span className={`${styles.statusDot} ${styles[connectionStatus]}`} />
					{pid && <span className={styles.pid}>{pid}</span>}
				</div>
			</div>

			{/* Row 2: 过滤 + 排序 + 视图 */}
			<div className={styles.bottomRow}>
				{/* 过滤 */}
				<div className={styles.filterCombo} ref={filterRef}>
					<input
						type="text"
						className={styles.filterComboInput}
						placeholder="Filter..."
						value={
							fileStore.filterType === "custom"
								? fileStore.filterText
								: selectedFilter.label
						}
						onChange={(e) => {
							const option = FILE_FILTER_OPTIONS.find(
								(opt) =>
									opt.label.toLowerCase() === e.target.value.toLowerCase(),
							);
							if (option) {
								fileStore.setFilterType(option.value);
								fileStore.setFilterText("");
							} else {
								fileStore.setFilterType("custom");
								fileStore.setFilterText(e.target.value);
							}
						}}
						onClick={() => setIsFilterOpen(true)}
					/>
					<button
						className={styles.filterComboBtn}
						onClick={() => setIsFilterOpen(!isFilterOpen)}
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>
					{isFilterOpen && (
						<div className={styles.filterDropdown}>
							{FILE_FILTER_OPTIONS.map((option) => (
								<div
									key={option.value}
									className={`${styles.filterDropdownItem} ${fileStore.filterType === option.value ? styles.active : ""}`}
									onClick={() => {
										fileStore.setFilterType(option.value);
										setIsFilterOpen(false);
									}}
								>
									<span>{option.icon}</span>
									<span>{option.label}</span>
								</div>
							))}
						</div>
					)}
				</div>

				{/* 排序 */}
				<div className={styles.sortCombo} ref={sortRef}>
					<button
						className={styles.sortComboBtn}
						onClick={() => setIsSortOpen(!isSortOpen)}
					>
						<span>
							{
								FILE_SORT_OPTIONS.find(
									(opt) => opt.value === fileStore.sortMode,
								)?.icon
							}
						</span>
						<span>
							{
								FILE_SORT_OPTIONS.find(
									(opt) => opt.value === fileStore.sortMode,
								)?.label
							}
						</span>
						<svg
							width="10"
							height="10"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>
					{isSortOpen && (
						<div className={styles.sortDropdown}>
							{FILE_SORT_OPTIONS.map((option) => (
								<div
									key={option.value}
									className={`${styles.sortDropdownItem} ${fileStore.sortMode === option.value ? styles.active : ""}`}
									onClick={() => {
										fileStore.setSortMode(option.value);
										setIsSortOpen(false);
									}}
								>
									<span>{option.icon}</span>
									<span>{option.label}</span>
								</div>
							))}
						</div>
					)}
				</div>

				{/* 视图切换 */}
				<button
					className={styles.iconBtn}
					onClick={() => fileStore.toggleViewMode()}
					title={fileStore.viewMode === "grid" ? "List View" : "Grid View"}
				>
					{fileStore.viewMode === "grid" ? (
						<svg
							width="16"
							height="16"
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
							width="16"
							height="16"
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
