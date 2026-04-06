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
import type { FileState, FileActions } from "@/features/files/types";

export type {
	FileItem,
	ViewMode,
	FileState,
	FileActions,
	SortMode,
	FilterType,
} from "@/features/files/types";

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
			}),
			{
				name: "file-storage",
				version: 1,
				partialize: (state) => ({
					currentPath: state.currentPath,
				}),
			},
		),
		{ name: "FileStore" },
	),
);
