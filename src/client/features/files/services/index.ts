/**
 * Files Feature Services
 */

// 命名空间导出 - 避免命名冲突
export * as fileApi from "./api/fileApi";
export * as fileOperationsApi from "./api/fileOperationsApi";
export * as gitApi from "./api/gitApi";
export * as todoApi from "./api/todoApi";

// 类型导出
export type {
  BrowseResponse,
  FileContentResponse,
  TreeNode,
  TreeResponse,
} from "./api/fileApi";

export type {
  DirectoryData,
} from "./api/fileOperationsApi";

export type {
  GitCommit,
  GitHistoryResponse,
  GitContentResponse,
  GitDiffResponse,
  GitCheckResponse,
  GitStatusResponse,
} from "./api/gitApi";

export type {
  TodoItem,
  AddTodoParams,
} from "./api/todoApi";

// 工具函数保持直接导出（这些不会冲突）
export {
  formatFileSize,
  getFileExtension,
  getFileIcon,
  getServerWorkingDir,
  checkPathExists,
} from "./api/fileApi";

// Service 层（业务逻辑组合）
export {
  getPersistedPath,
  initializeFilePath,
} from "./initialization";
