/**
 * AppHeader - Chat 顶部菜单（两行布局）
 * Row 1: 工作目录、思考级别、PID/状态
 * Row 2: 搜索框、模型选择
 */

import { useEffect, useState } from "react";
import { useChatController } from "@/features/chat/services/api/chatApi";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import {
	selectSearchFilters,
	selectSearchQuery,
	useChatStore,
} from "@/features/chat/stores/chatStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useWorkspaceStore } from "@/features/files/stores";
import { websocketService } from "@/services/websocket.service";
import styles from "./AppHeader.module.css";

// Thinking levels
const THINKING_LEVELS = [
	{ id: "off", name: "None" },
	{ id: "minimal", name: "Low" },
	{ id: "low", name: "Med" },
	{ id: "medium", name: "High" },
	{ id: "high", name: "XHigh" },
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

export function AppHeader({
	currentView = "chat",
	searchQuery: externalSearchQuery,
	searchFilters: externalSearchFilters,
	onSearchQueryChange,
	onSearchFiltersChange,
}: AppHeaderProps) {
	// ========== 1. State ==========
	// Store state
	const {
		currentModel,
		thinkingLevel,
		setThinkingLevel,
		serverPid,
		isConnected,
	} = useSessionStore();
	const { currentDir: workingDir } = useWorkspaceStore();
	const { isStreaming } = useChatStore();

	// Search state
	const chatStoreQuery = useChatStore(selectSearchQuery);
	const chatStoreFilters = useChatStore(selectSearchFilters);
	const chatStoreSetSearchQuery = useChatStore((s) => s.setSearchQuery);
	const chatStoreSetSearchFilters = useChatStore((s) => s.setSearchFilters);

	// UI state
	const [showFilters, setShowFilters] = useState(false);
	const [showModelDropdown, setShowModelDropdown] = useState(false);
	const [models, setModels] = useState<
		Array<{ id: string; name: string; provider: string }>
	>([]);
	const [modelsLoading, setModelsLoading] = useState(false);
	const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);

	// Service instances
	const chatController = useChatController();

	// Derived state
	const connectionStatus = isConnected ? "connected" : "disconnected";
	const pid = serverPid;
	const searchQuery = externalSearchQuery ?? chatStoreQuery;
	const filters = externalSearchFilters ?? chatStoreFilters;

	// ========== 4. Computed ==========
	const currentThinking =
		THINKING_LEVELS.find((t) => t.id === thinkingLevel) || THINKING_LEVELS[2];
	const hasActiveFilters =
		filters.user || filters.assistant || filters.thinking || filters.tools;
	const activeFilterCount = [
		filters.user,
		filters.assistant,
		filters.thinking,
		filters.tools,
	].filter(Boolean).length;
	const currentModelName = currentModel
		? models.find((m) => m.id === currentModel)?.name ||
			currentModel.split("-")[0]
		: "Select Model";

	// Directory browser modal
	const isDirectoryBrowserOpen = useModalStore(
		(state) => state.isDirectoryBrowserOpen,
	);
	const openDirectoryBrowser = useModalStore(
		(state) => state.openDirectoryBrowser,
	);
	const closeDirectoryBrowser = useModalStore(
		(state) => state.closeDirectoryBrowser,
	);

	// ========== 5. Actions ==========
	const handleFilterChange = (key: keyof typeof filters) => {
		if (onSearchFiltersChange) {
			onSearchFiltersChange({ ...filters, [key]: !filters[key] });
		} else {
			chatStoreSetSearchFilters({ [key]: !filters[key] });
		}
	};

	// ========== 3. Effects ==========
	// Load models
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
			try {
				await chatController.setModel(model.provider, model.id);
			} catch (error) {
				console.error("[AppHeader] Failed to set model:", error);
			}
		}
		setShowModelDropdown(false);
	};

	// Handle thinking level
	const handleThinkingSelect = (level: string) => {
		websocketService.send("thinking_level_change", {
			thinkingLevel: level,
		});
		setThinkingLevel(level as any);
		setShowThinkingDropdown(false);
	};

	// Close dropdowns on click outside
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

	return (
		<div className={styles.topBar}>
			{/* Row 1: 工作目录、思考级别、PID/状态 */}
			<div className={styles.topRow}>
				{/* 工作目录按钮 */}
				<button
					className={styles.workingDirBtn}
					onClick={() => openDirectoryBrowser()}
					title={`Working Directory: ${workingDir || "Click to select"}`}
				>
					<FolderIcon />
					<span className={styles.btnText}>
						{workingDir || "Select Directory"}
					</span>
				</button>

				{/* 思考级别 - 移到第1行 */}
				<div className={styles.thinkingSelector}>
					<button
						className={styles.selectorBtn}
						onClick={() => setShowThinkingDropdown(!showThinkingDropdown)}
						disabled={isStreaming}
						title="Thinking Level"
					>
						<span className={styles.selectorValue}>{currentThinking.name}</span>
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
									<span className={styles.thinkingName}>{t.name}</span>
								</div>
							))}
						</div>
					)}
				</div>

				<div className={styles.spacer} />

				{/* 状态 + PID */}
				<div
					className={styles.status}
					title={`${connectionStatus}${pid ? ` (PID: ${pid})` : ""}`}
				>
					<span className={`${styles.statusDot} ${styles[connectionStatus]}`} />
					{pid && <span className={styles.pid}>{pid}</span>}
				</div>
			</div>

			{/* Row 2: 搜索框、模型选择 */}
			<div className={styles.bottomRow}>
				{/* 搜索 - 与工作目录同宽 */}
				<div className={styles.searchWrapper}>
					<SearchIcon className={styles.searchIcon} />
					<input
						type="text"
						className={styles.searchInput}
						placeholder="Search messages..."
						value={searchQuery}
						onChange={(e) => {
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
					{/* 过滤按钮 - 在输入框最尾部 */}
					<button
						className={`${styles.filterToggle} ${hasActiveFilters ? styles.active : ""}`}
						onClick={() => setShowFilters(!showFilters)}
						title="Filters"
					>
						<FilterIcon />
						{hasActiveFilters && (
							<span className={styles.filterCount}>{activeFilterCount}</span>
						)}
					</button>

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

				<div className={styles.spacer} />

				{/* 模型选择 */}
				<div className={styles.modelSelector}>
					<button
						className={styles.selectorBtn}
						onClick={() => setShowModelDropdown(!showModelDropdown)}
						disabled={isStreaming}
						title="Select Model"
					>
						<span className={styles.selectorValue}>{currentModelName}</span>
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
			</div>

			{/* Directory Picker Modal */}
			{isDirectoryBrowserOpen && (
				<DirectoryPickerModal
					currentPath={workingDir || "/root"}
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

// Icons
function FolderIcon() {
	return (
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
			strokeWidth={2}
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
			strokeWidth={2}
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
			strokeWidth={2}
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

// Directory Picker Modal
function DirectoryPickerModal({
	currentPath,
	onClose,
}: {
	currentPath: string;
	onClose: () => void;
}) {
	const [path, setPath] = useState(currentPath);
	const [entries, setEntries] = useState<
		Array<{ name: string; path: string; isDirectory: boolean }>
	>([]);
	const [loading, setLoading] = useState(false);
	const sidebarController = useSidebarController();

	const loadDirectory = async (dirPath: string) => {
		setLoading(true);
		try {
			const response = await fetch("/api/browse", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: dirPath }),
			});
			const data = await response.json();
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

	const handleSelect = async () => {
		if (path && path !== currentPath) {
			await sidebarController.changeWorkingDir(path);
		}
		onClose();
	};

	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.pickerHeader}>
					<h4>Select Working Directory</h4>
					<button className={styles.closeBtn} onClick={onClose}>
						<XIcon />
					</button>
				</div>
				<div className={styles.currentPath}>{path}</div>
				<div className={styles.pickerActions}>
					<button className={styles.selectBtn} onClick={handleSelect}>
						Select This Directory
					</button>
				</div>
				<div className={styles.entriesList}>
					{loading ? (
						<div className={styles.loadingItem}>Loading...</div>
					) : (
						entries.map((entry) => (
							<div
								key={entry.path}
								className={styles.entry}
								onClick={() => loadDirectory(entry.path)}
							>
								<FolderIcon />
								<span>{entry.name}</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
