/**
 * 文件相关类型定义
 * 前后端共享的核心文件数据结构
 */

// ============================================================================
// 文件系统类型
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
	permissions?: string;
}

export interface FileContent {
	path: string;
	content: string;
	language?: string;
	exists?: boolean;
}

export interface ExecutionResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	duration: number;
}

// ============================================================================
// API请求/响应类型
// ============================================================================

export interface BrowseRequest {
	path: string;
}

export interface BrowseResponse {
	currentPath: string;
	parentPath: string | null;
	items: FileItem[];
}

export interface FileReadRequest {
	path: string;
}

export interface FileReadResponse {
	path: string;
	content: string;
	language?: string;
	exists: boolean;
}

export interface FileWriteRequest {
	path: string;
	content: string;
}

export interface FileWriteResponse {
	path: string;
	success: boolean;
	bytesWritten?: number;
	error?: string;
}

export interface FileDeleteRequest {
	path: string;
}

export interface FileDeleteResponse {
	path: string;
	success: boolean;
	error?: string;
}

export interface FileExecuteRequest {
	path: string;
	args?: string[];
	timeout?: number;
}

export interface FileExecuteResponse {
	path: string;
	stdout: string;
	stderr: string;
	exitCode: number;
	duration: number;
	success: boolean;
	error?: string;
}

export interface FileUploadRequest {
	path: string;
	content: string | Buffer;
	overwrite?: boolean;
}

export interface FileUploadResponse {
	path: string;
	success: boolean;
	size?: number;
	error?: string;
}

// ============================================================================
// 文件浏览器状态类型 (前端使用)
// ============================================================================

export interface FileBrowserState {
	// 当前目录
	currentPath: string;
	files: FileItem[];

	// 视图设置
	viewMode: ViewMode;
	sortField: SortField;
	sortOrder: SortOrder;
	filterQuery: string;

	// 选择
	selectedFiles: Set<string>;

	// 文件操作
	viewingFile: FileContent | null;
	editingFile: FileContent | null;
	executingFile: string | null;
	executionResult: ExecutionResult | null;

	// UI状态
	isLoading: boolean;
	isSaving: boolean;
	isExecuting: boolean;
	error: string | null;

	// 导航历史
	history: string[];
	historyIndex: number;
}
