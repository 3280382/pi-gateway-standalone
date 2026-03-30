/**
 * TopBar - Two Row Layout
 * Row 1: System Prompt, Model Selector, Thinking Mode, Connection Status
 * Row 2: Working Directory + Search & Filter
 */

import { useCallback, useEffect, useState } from "react";
import { useSidebarController } from "@/services/api/sidebarApi";
import {
	getSystemPrompt,
	type SystemPromptResponse,
} from "@/services/api/systemPromptApi";
import { websocketService } from "@/services/websocket.service";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import styles from "./TopBar.module.css";

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

interface TopBarProps {
	workingDir: string;
	connectionStatus: "connected" | "disconnected" | "connecting";
	pid: number | null;
}

export function TopBar({ workingDir, connectionStatus, pid }: TopBarProps) {
	const {
		currentModel,
		thinkingLevel,
		setThinkingLevel,
		setCurrentModel,
		serverPid,
	} = useSessionStore();
	const { isStreaming } = useChatStore();

	// Search state
	const searchQuery = useSidebarStore((state) => state.searchQuery);
	const filters = useSidebarStore((state) => state.searchFilters);
	const sidebarController = useSidebarController();
	const [showFilters, setShowFilters] = useState(false);

	// System prompt state
	const [showSystemPrompt, setShowSystemPrompt] = useState(false);
	const [systemPromptData, setSystemPromptData] =
		useState<SystemPromptResponse | null>(null);
	const [systemPromptLoading, setSystemPromptLoading] = useState(false);
	const [systemPromptError, setSystemPromptError] = useState<string | null>(
		null,
	);

	// Model dropdown state
	const [showModelDropdown, setShowModelDropdown] = useState(false);
	const [models, setModels] = useState<
		Array<{ id: string; name: string; provider: string }>
	>([]);
	const [modelsLoading, setModelsLoading] = useState(false);

	// Thinking dropdown state
	const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);

	// Working directory picker state
	const [showDirPicker, setShowDirPicker] = useState(false);

	const currentThinking =
		THINKING_LEVELS.find((t) => t.id === thinkingLevel) || THINKING_LEVELS[2];

	// Handle working directory selection
	const handleDirSelect = async (selectedPath: string) => {
		console.log(
			"[TopBar] Directory selected:",
			selectedPath,
			"current:",
			workingDir,
		);
		setShowDirPicker(false);
		if (selectedPath && selectedPath !== workingDir) {
			await sidebarController.changeWorkingDir(selectedPath);
		}
	};

	const handleFilterChange = (key: keyof typeof filters) => {
		sidebarController.setSearchFilters({ [key]: !filters[key] });
	};

	const hasActiveFilters =
		filters.user || filters.assistant || filters.thinking || filters.tools;
	const activeFilterCount = [
		filters.user,
		filters.assistant,
		filters.thinking,
		filters.tools,
	].filter(Boolean).length;

	// Load system prompt when modal opens
	useEffect(() => {
		if (showSystemPrompt && !systemPromptData && !systemPromptLoading) {
			setSystemPromptLoading(true);
			setSystemPromptError(null);
			getSystemPrompt(workingDir)
				.then((data) => {
					setSystemPromptData(data);
					setSystemPromptLoading(false);
				})
				.catch((err) => {
					setSystemPromptError(
						err instanceof Error ? err.message : "Failed to load",
					);
					setSystemPromptLoading(false);
				});
		}
	}, [showSystemPrompt, systemPromptData, systemPromptLoading, workingDir]);

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
	const handleModelSelect = (modelId: string) => {
		const model = models.find((m) => m.id === modelId);
		if (model) {
			console.log("[TopBar] Switching model:", model);
			// Send to server via WebSocket
			const sent = websocketService.send("model_change", {
				provider: model.provider,
				modelId: model.id,
			});
			console.log("[TopBar] model_change message sent:", sent);
			// Update local state
			setCurrentModel(modelId);
		}
		setShowModelDropdown(false);
	};

	// Handle thinking level selection
	const handleThinkingSelect = (level: string) => {
		console.log("[TopBar] Switching thinking level:", level);
		// Send to server via WebSocket
		const sent = websocketService.send("thinking_level_change", {
			thinkingLevel: level,
		});
		console.log("[TopBar] thinking_level_change message sent:", sent);
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

	return (
		<div className={styles.topBar}>
			{/* Row 1: System Prompt, Model, Thinking, Status */}
			<div className={styles.topRow}>
				{/* Left: System Prompt */}
				<button
					className={styles.iconBtn}
					onClick={() => setShowSystemPrompt(true)}
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
					onClick={() => setShowDirPicker(true)}
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
							onChange={(e) => sidebarController.setSearchQuery(e.target.value)}
						/>
						{searchQuery && (
							<button
								className={styles.clearBtn}
								onClick={() => sidebarController.setSearchQuery("")}
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

			{/* System Prompt Modal */}
			{showSystemPrompt && (
				<div
					className={styles.modal}
					onClick={() => setShowSystemPrompt(false)}
				>
					<div
						className={styles.modalContent}
						onClick={(e) => e.stopPropagation()}
					>
						<div className={styles.modalHeader}>
							<h3>System Prompt - {systemPromptData?.cwd || workingDir}</h3>
							<button
								className={styles.closeBtn}
								onClick={() => setShowSystemPrompt(false)}
								title="Close"
							>
								✕
							</button>
						</div>
						<div className={styles.modalBody}>
							{systemPromptLoading && (
								<div className={styles.loading}>Loading...</div>
							)}
							{systemPromptError && (
								<div className={styles.error}>{systemPromptError}</div>
							)}
							{systemPromptData && (
								<div className={styles.systemPromptContent}>
									{systemPromptData.agentsFiles.length > 0 && (
										<div className={styles.section}>
											<h4>AGENTS.md ({systemPromptData.agentsFiles.length})</h4>
											{systemPromptData.agentsFiles.map((file, idx) => (
												<div key={idx} className={styles.fileBlock}>
													<div className={styles.filePath}>{file.path}</div>
													<pre className={styles.fileContent}>
														{file.content}
													</pre>
												</div>
											))}
										</div>
									)}
									{systemPromptData.systemPrompt && (
										<div className={styles.section}>
											<h4>SYSTEM</h4>
											<pre className={styles.fileContent}>
												{systemPromptData.systemPrompt}
											</pre>
										</div>
									)}
									{systemPromptData.skills.length > 0 && (
										<div className={styles.section}>
											<h4>Skills ({systemPromptData.skills.length})</h4>
											<ul className={styles.skillList}>
												{systemPromptData.skills
													.slice(0, 10)
													.map((skill, idx) => (
														<li key={idx}>
															<strong>{skill.name}</strong>:{" "}
															{skill.description.slice(0, 100)}
															{skill.description.length > 100 ? "..." : ""}
														</li>
													))}
												{systemPromptData.skills.length > 10 && (
													<li>
														... and {systemPromptData.skills.length - 10} more
													</li>
												)}
											</ul>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Directory Picker Modal */}
			{showDirPicker && (
				<DirectoryPicker
					currentPath={workingDir || "/root"}
					onSelect={handleDirSelect}
					onClose={() => setShowDirPicker(false)}
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
