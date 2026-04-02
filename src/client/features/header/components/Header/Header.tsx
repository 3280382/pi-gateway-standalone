/**
 * Header - Main header container for Chat view
 * Combines all header sub-components
 */

import { useState, useEffect, useCallback } from "react";
import { useChatController } from "@/services/api/chatApi";
import { useSidebarController } from "@/services/api/sidebarApi";
import { websocketService } from "@/services/websocket.service";
import {
	selectSearchFilters,
	selectSearchQuery,
	useChatStore,
} from "@/stores/chatStore";
import { useModalStore } from "@/stores/modalStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { HeaderProps, Model, SearchFilters } from "../../types";
import { ConnectionStatus } from "../ConnectionStatus";
import { DirectoryPicker } from "../DirectoryPicker";
import { ModelSelector } from "../ModelSelector";
import { SearchBox } from "../SearchBox";
import { ThinkingSelector } from "../ThinkingSelector";
import styles from "./Header.module.css";

// Icons
function DocumentIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
		</svg>
	);
}

function FolderIcon({ className }: { className?: string }) {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
			<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
		</svg>
	);
}

export function Header({ workingDir, connectionStatus, pid }: HeaderProps) {
	const { currentModel, thinkingLevel, setThinkingLevel, serverPid } = useSessionStore();
	const { isStreaming } = useChatStore();
	const chatController = useChatController();
	const sidebarController = useSidebarController();
	const openSystemPrompt = useModalStore((state) => state.openSystemPrompt);

	// Modal states
	const isDirectoryBrowserOpen = useModalStore((state) => state.isDirectoryBrowserOpen);
	const closeDirectoryBrowser = useModalStore((state) => state.closeDirectoryBrowser);

	// Model selector state
	const [models, setModels] = useState<Model[]>([]);
	const [modelsLoading, setModelsLoading] = useState(false);
	const [showModelDropdown, setShowModelDropdown] = useState(false);

	// Search state from store
	const searchQuery = useChatStore(selectSearchQuery);
	const filters = useChatStore(selectSearchFilters);
	const setSearchQuery = useChatStore((s) => s.setSearchQuery);
	const setSearchFilters = useChatStore((s) => s.setSearchFilters);

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
				.catch(() => setModelsLoading(false));
		}
	}, [showModelDropdown, models.length, modelsLoading]);

	// Close dropdowns when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest(".modelSelector")) {
				setShowModelDropdown(false);
			}
		};
		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, []);

	const handleModelSelect = async (modelId: string) => {
		const model = models.find((m) => m.id === modelId);
		if (model) {
			await chatController.setModel(model.provider, model.id);
		}
		setShowModelDropdown(false);
	};

	const handleThinkingSelect = (level: string) => {
		websocketService.send("thinking_level_change", { thinkingLevel: level });
		setThinkingLevel(level as any);
	};

	const handleDirSelect = async (selectedPath: string) => {
		closeDirectoryBrowser();
		if (selectedPath && selectedPath !== workingDir) {
			await sidebarController.changeWorkingDir(selectedPath);
		}
	};

	const formatWorkingDir = (path: string) => {
		if (!path) return "No workspace";
		const parts = path.split("/").filter(Boolean);
		if (parts.length <= 2) return path;
		return ".../" + parts.slice(-2).join("/");
	};

	return (
		<div className={styles.header}>
			{/* Row 1: Controls */}
			<div className={styles.topRow}>
				<button className={styles.iconBtn} onClick={() => openSystemPrompt()} title="System Prompt">
					<DocumentIcon />
				</button>

				<div className={styles.modelSelector}>
					<ModelSelector
						models={models}
						currentModel={currentModel}
						isLoading={modelsLoading}
						isStreaming={isStreaming}
						onSelect={handleModelSelect}
					/>
				</div>

				<ThinkingSelector
					currentLevel={thinkingLevel}
					isStreaming={isStreaming}
					onSelect={handleThinkingSelect}
				/>

				<ConnectionStatus status={connectionStatus} pid={pid || serverPid} />
			</div>

			{/* Row 2: Working Directory + Search */}
			<div className={styles.bottomRow}>
				<button
					className={styles.workingDirBtn}
					onClick={() => useModalStore.getState().openDirectoryBrowser()}
					title={`Working Directory: ${workingDir || "Click to select"}`}
				>
					<FolderIcon className={styles.btnIcon} />
					<span>{formatWorkingDir(workingDir)}</span>
				</button>

				<SearchBox
					query={searchQuery}
					filters={filters}
					onQueryChange={setSearchQuery}
					onFiltersChange={(f) => setSearchFilters(f)}
				/>
			</div>

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
