/**
 * FileBrowser Store - Zustand State Management
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
	ExecutionResult,
	FileBrowserState,
	FileContent,
	FileItem,
	SortField,
	SortOrder,
	ViewMode,
} from "./types";

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = (): Omit<
	FileBrowserState,
	keyof FileBrowserActions
> => ({
	currentPath: "",
	files: [],

	viewMode: "list",
	sortField: "name",
	sortOrder: "asc",
	filterQuery: "",

	selectedFiles: new Set(),

	viewingFile: null,
	editingFile: null,
	executingFile: null,
	executionResult: null,

	isLoading: false,
	isSaving: false,
	isExecuting: false,
	error: null,

	history: [],
	historyIndex: -1,
});

// ============================================================================
// Actions Interface
// ============================================================================

interface FileBrowserActions {
	// Data Actions
	setCurrentPath: (path: string) => void;
	setFiles: (files: FileItem[]) => void;

	// View Actions
	setViewMode: (mode: ViewMode) => void;
	setSortField: (field: SortField) => void;
	setSortOrder: (order: SortOrder) => void;
	toggleSortOrder: () => void;
	setFilterQuery: (query: string) => void;

	// Selection Actions
	selectFile: (path: string, multi?: boolean) => void;
	deselectFile: (path: string) => void;
	selectAll: (paths?: string[]) => void;
	deselectAll: () => void;
	toggleSelection: (path: string, multi?: boolean) => void;

	// File Operation Actions
	setViewingFile: (file: FileContent | null) => void;
	setEditingFile: (file: FileContent | null) => void;
	setExecutingFile: (path: string | null) => void;
	setExecutionResult: (result: ExecutionResult | null) => void;

	// Navigation Actions
	navigateTo: (path: string) => void;
	navigateBack: () => void;
	navigateForward: () => void;
	navigateUp: () => void;

	// UI Actions
	setLoading: (loading: boolean) => void;
	setSaving: (saving: boolean) => void;
	setExecuting: (executing: boolean) => void;
	setError: (error: string | null) => void;
	clearError: () => void;

	// Reset
	reset: () => void;
}

// ============================================================================
// Store Creation
// ============================================================================

export const useFileBrowserStore = create<
	FileBrowserState & FileBrowserActions
>()(
	devtools(
		(set, get) => ({
			...createInitialState(),

			// Data Actions
			setCurrentPath: (path: string) => {
				set({ currentPath: path }, false, "setCurrentPath");
			},

			setFiles: (files: FileItem[]) => {
				set({ files }, false, "setFiles");
			},

			// View Actions
			setViewMode: (mode: ViewMode) => {
				set({ viewMode: mode }, false, "setViewMode");
			},

			setSortField: (field: SortField) => {
				set({ sortField: field }, false, "setSortField");
			},

			setSortOrder: (order: SortOrder) => {
				set({ sortOrder: order }, false, "setSortOrder");
			},

			toggleSortOrder: () => {
				set(
					(state) => ({
						sortOrder: state.sortOrder === "asc" ? "desc" : "asc",
					}),
					false,
					"toggleSortOrder",
				);
			},

			setFilterQuery: (query: string) => {
				set({ filterQuery: query }, false, "setFilterQuery");
			},

			// Selection Actions
			selectFile: (path: string, multi = false) => {
				set(
					(state) => ({
						selectedFiles: multi
							? new Set([...state.selectedFiles, path])
							: new Set([path]),
					}),
					false,
					"selectFile",
				);
			},

			deselectFile: (path: string) => {
				set(
					(state) => {
						const newSet = new Set(state.selectedFiles);
						newSet.delete(path);
						return { selectedFiles: newSet };
					},
					false,
					"deselectFile",
				);
			},

			selectAll: (paths?: string[]) => {
				set(
					(state) => ({
						selectedFiles: new Set(paths ?? state.files.map((f) => f.path)),
					}),
					false,
					"selectAll",
				);
			},

			deselectAll: () => {
				set({ selectedFiles: new Set() }, false, "deselectAll");
			},

			toggleSelection: (path: string, multi = false) => {
				set(
					(state) => {
						const newSet = multi
							? new Set(state.selectedFiles)
							: new Set<string>();
						if (state.selectedFiles.has(path)) {
							newSet.delete(path);
						} else {
							newSet.add(path);
						}
						return { selectedFiles: newSet };
					},
					false,
					"toggleSelection",
				);
			},

			// File Operation Actions
			setViewingFile: (file: FileContent | null) => {
				set({ viewingFile: file }, false, "setViewingFile");
			},

			setEditingFile: (file: FileContent | null) => {
				set({ editingFile: file }, false, "setEditingFile");
			},

			setExecutingFile: (path: string | null) => {
				set({ executingFile: path }, false, "setExecutingFile");
			},

			setExecutionResult: (result: ExecutionResult | null) => {
				set({ executionResult: result }, false, "setExecutionResult");
			},

			// Navigation Actions
			navigateTo: (path: string) => {
				set(
					(state) => {
						const newHistory = state.history.slice(0, state.historyIndex + 1);
						newHistory.push(path);
						return {
							currentPath: path,
							history: newHistory,
							historyIndex: newHistory.length - 1,
							selectedFiles: new Set(),
						};
					},
					false,
					"navigateTo",
				);
			},

			navigateBack: () => {
				set(
					(state) => {
						if (state.historyIndex > 0) {
							const newIndex = state.historyIndex - 1;
							return {
								currentPath: state.history[newIndex],
								historyIndex: newIndex,
								selectedFiles: new Set(),
							};
						}
						return state;
					},
					false,
					"navigateBack",
				);
			},

			navigateForward: () => {
				set(
					(state) => {
						if (state.historyIndex < state.history.length - 1) {
							const newIndex = state.historyIndex + 1;
							return {
								currentPath: state.history[newIndex],
								historyIndex: newIndex,
								selectedFiles: new Set(),
							};
						}
						return state;
					},
					false,
					"navigateForward",
				);
			},

			navigateUp: () => {
				const { currentPath, navigateTo } = get();
				if (!currentPath) return;

				const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
				if (parentPath !== currentPath) {
					navigateTo(parentPath);
				}
			},

			// UI Actions
			setLoading: (loading: boolean) => {
				set({ isLoading: loading }, false, "setLoading");
			},

			setSaving: (saving: boolean) => {
				set({ isSaving: saving }, false, "setSaving");
			},

			setExecuting: (executing: boolean) => {
				set({ isExecuting: executing }, false, "setExecuting");
			},

			setError: (error: string | null) => {
				set({ error }, false, "setError");
			},

			clearError: () => {
				set({ error: null }, false, "clearError");
			},

			// Reset
			reset: () => {
				set(createInitialState(), false, "reset");
			},
		}),
		{ name: "FileBrowserStore" },
	),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectFilteredAndSortedFiles = (
	state: FileBrowserState,
): FileItem[] => {
	let files = [...state.files];

	// Apply filter
	if (state.filterQuery) {
		const query = state.filterQuery.toLowerCase();
		files = files.filter((f) => f.name.toLowerCase().includes(query));
	}

	// Apply sort
	files.sort((a, b) => {
		let comparison = 0;

		switch (state.sortField) {
			case "name":
				comparison = a.name.localeCompare(b.name);
				break;
			case "size":
				comparison = a.size - b.size;
				break;
			case "modified":
				comparison = a.modified.getTime() - b.modified.getTime();
				break;
			case "type":
				comparison = a.type.localeCompare(b.type);
				break;
		}

		return state.sortOrder === "asc" ? comparison : -comparison;
	});

	// Directories first
	files.sort((a, b) => {
		if (a.type === b.type) return 0;
		return a.type === "directory" ? -1 : 1;
	});

	return files;
};

export const selectSelectedFiles = (state: FileBrowserState): FileItem[] => {
	return state.files.filter((f) => state.selectedFiles.has(f.path));
};

export const selectCanNavigateBack = (state: FileBrowserState): boolean => {
	return state.historyIndex > 0;
};

export const selectCanNavigateForward = (state: FileBrowserState): boolean => {
	return state.historyIndex < state.history.length - 1;
};

export const selectCanNavigateUp = (state: FileBrowserState): boolean => {
	return state.currentPath !== "" && state.currentPath !== "/";
};
