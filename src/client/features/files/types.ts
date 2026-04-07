/**
 * Files Feature - Type Definitions
 *
 * 职责：前端文件功能特有的基础类型定义
 * 注意：FileState/FileActions 已内联到 fileStore.ts
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
