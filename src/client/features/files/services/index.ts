/**
 * Files Feature Services
 */

// 类型导出
export type {
  BrowseResponse,
  FileContentResponse,
  TreeNode,
  TreeResponse,
} from "./api/fileApi";
// 命名空间导出 - 避免命名冲突
export * as fileApi from "./api/fileApi";
// 工具函数保持直接导出（这些不会冲突）
export {
  checkPathExists,
  formatFileSize,
  getFileExtension,
  getFileIcon,
  getServerWorkingDir,
} from "./api/fileApi";
export type { DirectoryData } from "./api/fileOperationsApi";
export * as fileOperationsApi from "./api/fileOperationsApi";
export type {
  GitCheckResponse,
  GitCommit,
  GitContentResponse,
  GitDiffResponse,
  GitHistoryResponse,
  GitStatusResponse,
} from "./api/gitApi";
export * as gitApi from "./api/gitApi";

export type {
  AddTodoParams,
  TodoItem,
} from "./api/todoApi";
export * as todoApi from "./api/todoApi";

// Service 层（业务逻辑组合）
export {
  getPersistedPath,
  initializeFilePath,
} from "./initialization";
