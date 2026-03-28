/**
 * FileBrowser Types - Type Definitions
 */

// ============================================================================
// Domain Types
// ============================================================================

export type FileType = "file" | "directory";

export type SortField = "name" | "size" | "modified" | "type";
export type SortOrder = "asc" | "desc";
export type ViewMode = "grid" | "list";

export interface FileItem {
	name: string;
	path: string;
	isDirectory: boolean;
	size?: number;
	modified?: string;
	extension?: string;
}

export interface FileContent {
	path: string;
	content: string;
	language?: string;
}

export interface ExecutionResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	duration: number;
}

// ============================================================================
// API Types
// ============================================================================

export interface BrowseResponse {
	currentPath: string;
	parentPath: string;
	items: FileItem[];
}

export interface FileReadResponse {
	path: string;
	content: string;
}

export interface FileWriteResponse {
	path: string;
	success: boolean;
}

export interface FileExecuteResponse {
	stdout: string;
	stderr: string;
	exitCode: number;
}

// ============================================================================
// State Types
// ============================================================================

export interface FileBrowserState {
	// Current directory
	currentPath: string;
	files: FileItem[];

	// View settings
	viewMode: ViewMode;
	sortField: SortField;
	sortOrder: SortOrder;
	filterQuery: string;

	// Selection
	selectedFiles: Set<string>;

	// File operations
	viewingFile: FileContent | null;
	editingFile: FileContent | null;
	executingFile: string | null;
	executionResult: ExecutionResult | null;

	// UI State
	isLoading: boolean;
	isSaving: boolean;
	isExecuting: boolean;
	error: string | null;

	// Navigation history
	history: string[];
	historyIndex: number;
}

// ============================================================================
// Component Props
// ============================================================================

export interface FileBrowserProps {
	initialPath?: string;
	onFileSelect?: (files: FileItem[]) => void;
	onPathChange?: (path: string) => void;
	readOnly?: boolean;
}

export interface FileToolbarProps {
	viewMode: ViewMode;
	sortField: SortField;
	sortOrder: SortOrder;
	filterQuery: string;
	selectedCount: number;
	onViewModeChange: (mode: ViewMode) => void;
	onSortChange: (field: SortField, order: SortOrder) => void;
	onFilterChange: (query: string) => void;
	onNavigateUp: () => void;
	canNavigateUp: boolean;
	onRefresh: () => void;
	onExecuteSelected: () => void;
}

export interface FileViewerProps {
	file: FileContent;
	onClose: () => void;
	onEdit: () => void;
}

export interface FileEditorProps {
	file: FileContent;
	onSave: (content: string) => void;
	onCancel: () => void;
	isSaving: boolean;
}

export interface FileListProps {
	files: FileItem[];
	viewMode: ViewMode;
	selectedFiles: Set<string>;
	currentPath: string;
	onFileClick: (file: FileItem) => void;
	onFileDoubleClick: (file: FileItem) => void;
	onSelectToggle: (file: FileItem, multi: boolean) => void;
	onNavigate: (path: string) => void;
}
