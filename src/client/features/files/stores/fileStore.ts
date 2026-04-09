/**
 * File Store - 文件浏览器状态管理
 *
 * 职责：纯状态管理
 * - 不包含业务逻辑
 * - 不包含 API 调用
 * - 只提供状态读取和设置方法
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type {
	BottomPanelType,
	FileItem,
	FilterType,
	SortMode,
	ViewMode,
} from "@/features/files/types";

// ============================================================================
// Store State & Actions Types (内联定义)
// ============================================================================

export interface FileState {
	// 文件浏览状态
	currentPath: string;
	parentPath: string;
	items: FileItem[];
	selectedItems: string[];
	pathCache: Map<string, { items: FileItem[]; timestamp: number }>;
	viewMode: ViewMode;
	sortMode: SortMode;
	filterType: FilterType;
	filterText: string;
	isLoading: boolean;
	error: string | null;
	selectedActionFile: string | null;
	selectedActionFileName: string | null;
	isMultiSelectMode: boolean;
	draggedItem: FileItem | null;
	isDragging: boolean;

	// 布局状态
	isSidebarVisible: boolean;
	isBottomPanelOpen: boolean;
	bottomPanelType: BottomPanelType;
	bottomPanelHeight: number;
}

export interface FileActions {
	// 文件操作
	setCurrentPath: (path: string) => void;
	setParentPath: (path: string) => void;
	setItems: (items: FileItem[]) => void;
	setSelectedItems: (items: string[]) => void;
	setPathCache: (
		cache: Map<string, { items: FileItem[]; timestamp: number }>,
	) => void;
	setViewMode: (mode: ViewMode) => void;
	setSortMode: (mode: SortMode) => void;
	setFilterType: (type: FilterType) => void;
	setFilterText: (text: string) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	setSelectedActionFile: (path: string | null, name: string | null) => void;
	setIsMultiSelectMode: (enabled: boolean) => void;
	setDraggedItem: (item: FileItem | null) => void;
	setIsDragging: (isDragging: boolean) => void;
	toggleSelection: (path: string) => void;
	clearSelection: () => void;
	toggleViewMode: () => void;
	toggleMultiSelectMode: () => void;
	isSelected: (path: string) => boolean;

	// 布局操作
	setSidebarVisible: (visible: boolean) => void;
	toggleSidebar: () => void;
	openBottomPanel: (type: BottomPanelType) => void;
	closeBottomPanel: () => void;
	toggleBottomPanel: (type: BottomPanelType) => void;
	setBottomPanelHeight: (height: number) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useFileStore = create<FileState & FileActions>()(
	devtools(
		persist(
			(set, get) => ({
				// 初始状态
				currentPath: "/root",
				parentPath: "/",
				items: [],
				selectedItems: [],
				pathCache: new Map(),
				viewMode: "grid",
				sortMode: "time-desc",
				filterType: "all",
				filterText: "",
				isLoading: false,
				error: null,
				selectedActionFile: null,
				selectedActionFileName: null,
				isMultiSelectMode: false,
				draggedItem: null,
				isDragging: false,

				// 布局状态
				isSidebarVisible:
					typeof window !== "undefined" ? window.innerWidth >= 768 : true,
				isBottomPanelOpen: false,
				bottomPanelType: null,
				bottomPanelHeight: 300,

				// 基本设置方法
				setCurrentPath: (path) => set({ currentPath: path }),
				setParentPath: (path) => set({ parentPath: path }),
				setItems: (items) => set({ items }),
				setSelectedItems: (selectedItems) => set({ selectedItems }),
				setPathCache: (pathCache) => set({ pathCache }),
				setViewMode: (viewMode) => set({ viewMode }),
				setSortMode: (sortMode) => set({ sortMode }),
				setFilterType: (filterType) => set({ filterType }),
				setFilterText: (filterText) => set({ filterText }),
				setLoading: (isLoading) => set({ isLoading }),
				setError: (error) => set({ error }),
				setSelectedActionFile: (selectedActionFile, selectedActionFileName) =>
					set({ selectedActionFile, selectedActionFileName }),
				setIsMultiSelectMode: (isMultiSelectMode) => set({ isMultiSelectMode }),
				setDraggedItem: (draggedItem) => set({ draggedItem }),
				setIsDragging: (isDragging) => set({ isDragging }),

				// 切换方法
				toggleSelection: (path) =>
					set((state) => {
						const exists = state.selectedItems.includes(path);
						return {
							selectedItems: exists
								? state.selectedItems.filter((p) => p !== path)
								: [...state.selectedItems, path],
						};
					}),

				clearSelection: () => set({ selectedItems: [] }),

				toggleViewMode: () =>
					set((state) => ({
						viewMode: state.viewMode === "grid" ? "list" : "grid",
					})),

				toggleMultiSelectMode: () =>
					set((state) => ({
						isMultiSelectMode: !state.isMultiSelectMode,
						selectedItems: !state.isMultiSelectMode ? [] : state.selectedItems,
					})),

				isSelected: (path) => get().selectedItems.includes(path),

				// 布局操作
				setSidebarVisible: (visible: boolean) =>
					set({ isSidebarVisible: visible }),

				toggleSidebar: () =>
					set((state) => ({ isSidebarVisible: !state.isSidebarVisible })),

				openBottomPanel: (type) =>
					set({ bottomPanelType: type, isBottomPanelOpen: true }),

				closeBottomPanel: () =>
					set({ isBottomPanelOpen: false, bottomPanelType: null }),

				toggleBottomPanel: (type) => {
					const { bottomPanelType, isBottomPanelOpen } = get();
					if (bottomPanelType === type && isBottomPanelOpen) {
						set({ isBottomPanelOpen: false, bottomPanelType: null });
					} else {
						set({ bottomPanelType: type, isBottomPanelOpen: true });
					}
				},

				setBottomPanelHeight: (height: number) =>
					set({ bottomPanelHeight: height }),
			}),
			{
				name: "files:browser",
				version: 1,
				partialize: (state) => ({
					currentPath: state.currentPath,
					viewMode: state.viewMode,
					sortMode: state.sortMode,
					filterType: state.filterType,
					isSidebarVisible: state.isSidebarVisible,
					bottomPanelHeight: state.bottomPanelHeight,
				}),
			},
		),
		{ name: "FileStore" },
	),
);

// 基础类型重新导出，方便使用
export type {
	BottomPanelType,
	FileItem,
	FilterType,
	SortMode,
	ViewMode,
} from "@/features/files/types";
