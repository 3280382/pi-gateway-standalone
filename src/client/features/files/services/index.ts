/**
 * Files Feature Services
 */

// API 层（直接 HTTP 调用）
export {
	browseDirectory,
	checkPathExists,
	executeFile,
	formatFileSize,
	getFileExtension,
	getFileIcon,
	getFileTree,
	getRawFileUrl,
	getServerWorkingDir,
	readFile,
	type BrowseResponse,
	type FileContentResponse,
	type TreeNode,
	type TreeResponse,
	writeFile,
} from "./api/fileApi";

export {
	batchDeleteFiles,
	batchMoveFiles,
	createFile,
	executeFileByPath,
	getFriendlyErrorMessage,
	loadDirectoryContent,
	type DirectoryData,
} from "./api/fileOperationsApi";

// Service 层（业务逻辑组合）
export {
	getPersistedPath,
	initializeFilePath,
} from "./initialization";
