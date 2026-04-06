/**
 * Files Feature - Type Definitions
 *
 * 职责：前端文件功能特有的类型定义
 */

// ============================================================================
// 核心文件类型（原本在 shared，现在移到 client）
// ============================================================================

export interface FileItem {
	name: string;
	path: string;
	isDirectory: boolean;
	size?: number;
	modified?: string;
	extension?: string;
}

export type ViewMode = "grid" | "list";

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
// Layout Types
// ============================================================================

export type BottomPanelType = "terminal" | "preview" | null;

// ============================================================================
// Store State Types
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
