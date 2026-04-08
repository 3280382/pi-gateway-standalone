/**
 * Files Feature Services
 */

// API 层（直接 HTTP 调用）
export {
	type BrowseResponse,
	browseDirectory,
	checkPathExists,
	executeFile,
	type FileContentResponse,
	formatFileSize,
	getFileExtension,
	getFileIcon,
	getFileTree,
	getRawFileUrl,
	getServerWorkingDir,
	readFile,
	type TreeNode,
	type TreeResponse,
	writeFile,
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

// Service 层（业务逻辑组合）
export {
	getPersistedPath,
	initializeFilePath,
} from "./initialization";
