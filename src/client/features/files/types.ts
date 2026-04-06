/**
 * Files Feature - Type Definitions
 *
 * 职责：前端文件功能特有的类型定义
 * - 复用 src/shared/types/file.types.ts 中的共享类型
 * - 定义前端特有的类型（Store状态、组件Props等）
 */

import type {
	FileItem,
	ViewMode,
} from "@shared/types/file.types";

// 重新导出共享类型
export type { FileItem, ViewMode };

// ============================================================================
// 前端特有类型
// ============================================================================

export type SortMode =
	| "time-desc"
	| "time-asc"
	| "name-asc"
	| "name-desc"
	| "type"
	| "size-desc"
	| "size-asc";

export type FilterType =
	| "all"
	| "dir"
	| "text"
	| "html"
	| "js"
	| "py"
	| "sh"
	| "java"
	| "json"
	| "md"
	| "image"
	| "code"
	| "media"
	| "doc"
	| "custom";

// ============================================================================
// Store State Types (前端特有)
// ============================================================================

export interface FileState {
	// 当前路径
	currentPath: string;
	parentPath: string;

	// 文件列表
	items: FileItem[];
	selectedItems: string[];

	// 路径缓存
	pathCache: Map<string, { items: FileItem[]; timestamp: number }>;

	// 视图设置
	viewMode: ViewMode;
	sortMode: SortMode;
	filterType: FilterType;
	filterText: string;

	// UI状态
	isLoading: boolean;
	error: string | null;

	// 选中文件（用于操作）
	selectedActionFile: string | null;
	selectedActionFileName: string | null;

	// 多选模式
	isMultiSelectMode: boolean;

	// 拖拽状态
	draggedItem: FileItem | null;
	isDragging: boolean;
}

export interface FileActions {
	// 状态设置方法
	setCurrentPath: (path: string) => void;
	setParentPath: (path: string) => void;
	setItems: (items: FileItem[]) => void;
	setSelectedItems: (items: string[]) => void;
	setPathCache: (cache: Map<string, { items: FileItem[]; timestamp: number }>) => void;
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

	// 简单的状态切换
	toggleSelection: (path: string) => void;
	clearSelection: () => void;
	toggleViewMode: () => void;
	toggleMultiSelectMode: () => void;
	isSelected: (path: string) => boolean;
}
