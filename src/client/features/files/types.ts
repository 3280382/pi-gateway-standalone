/**
 * Files Feature - Type Definitions
 *
 * Responsibilities:前端文件功能特有的基础类型定义
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
  gitStatus?: string;
}

export type ViewMode = "grid" | "list" | "tree";

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
// API Response Types (从 fileApi.ts 合并)
// ============================================================================

export interface BrowseResponse {
  workingDir: string;
  parentPath: string;
  items: FileItem[];
}

export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  modified: string;
}

export interface FileReadResponse {
  path: string;
  content: string;
}

export interface FileExecuteResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  truncated?: boolean;
  gitStatus?: string; // Git状态
  // 新增计算字段，供前端直接使用
  level?: number; // 层级深度
  isLast?: boolean; // 是否是兄弟节点中的最后一个
  parentLastStack?: boolean[]; // 父节点 isLast 的堆栈，用于绘制连接线
  parentPath?: string; // 父节点路径
}

export interface TreeResponse {
  path: string;
  items: TreeNode[];
}

// ============================================================================
// Todo Types
// ============================================================================

export interface TodoItem {
  id: number;
  checked: boolean;
  filePath: string;
  text: string;
  tags: string[];
  assignee?: string;
  dueDate?: string;
  raw: string;
}
