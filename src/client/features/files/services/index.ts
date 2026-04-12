/**
 * Files Feature Services
 */

// API 层（直接 HTTP 调用）
export {
  type BrowseResponse,
  browse,
  checkPathExists,
  execute,
  type FileContentResponse,
  formatFileSize,
  getFileExtension,
  getFileIcon,
  tree,
  raw,
  getServerWorkingDir,
  content,
  type TreeNode,
  type TreeResponse,
  write,
} from "./api/fileApi";

export {
  batchDeleteFiles,
  batchMoveFiles,
  createFile,
  type DirectoryData,
  executeFileByPath,
  getFriendlyErrorMessage,
  loadDirectoryContent,
} from "./api/fileOperationsApi";

export {
  history,
  content as gitContent,
  diff,
  check,
  status,
  type GitCommit,
  type GitHistoryResponse,
  type GitContentResponse,
  type GitDiffResponse,
  type GitCheckResponse,
  type GitStatusResponse,
} from "./api/gitApi";

export {
  add,
  list,
  toggle,
  type TodoItem,
  type AddTodoParams,
} from "./api/todoApi";

// Service 层（业务逻辑组合）
export {
  getPersistedPath,
  initializeFilePath,
} from "./initialization";
