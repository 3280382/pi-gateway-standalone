/**
 * File Service - 处理文件相关的业务逻辑
 */

import { BaseService, ServiceError } from "./base.service";

export interface FileItem {
	name: string;
	path: string;
	isDirectory: boolean;
	size: number;
	modified: string;
	extension?: string;
	permissions?: string;
}

export interface BrowseResponse {
	currentPath: string;
	parentPath: string;
	items: FileItem[];
	metadata: {
		count: number;
		directories: number;
		files: number;
		processingTime: number;
	};
}

export interface FileContentResponse {
	path: string;
	content: string;
	size: number;
	encoding: string;
	modified: string;
}

export interface WriteFileRequest {
	path: string;
	content: string;
	encoding?: string;
}

export interface ExecuteRequest {
	command: string;
	workingDir?: string;
	args?: string[];
	streaming?: boolean;
}

export interface ExecuteResponse {
	stdout: string;
	stderr: string;
	exitCode: number;
	executionTime: number;
}

export interface SearchFilesRequest {
	query: string;
	path?: string;
	extensions?: string[];
	maxResults?: number;
	recursive?: boolean;
}

export interface SearchResult {
	path: string;
	name: string;
	score: number;
	matches: Array<{
		line: number;
		content: string;
		highlight: string;
	}>;
}

export interface FileOperationResponse {
	success: boolean;
	message?: string;
	details?: any;
}

export class FileService extends BaseService {
	constructor() {
		super("FileService", "/api");
	}

	/**
	 * 浏览目录
	 */
	async browse(path?: string): Promise<BrowseResponse> {
		try {
			return await this.post<BrowseResponse>("/browse", { path });
		} catch (error) {
			throw new ServiceError(
				"BROWSE_FAILED",
				"Failed to browse directory",
				error,
			);
		}
	}

	/**
	 * 读取文件内容
	 */
	async readFile(
		path: string,
		encoding: string = "utf-8",
	): Promise<FileContentResponse> {
		try {
			const params = { path, encoding };
			return await this.post<FileContentResponse>("/files/content", params);
		} catch (error) {
			throw new ServiceError("READ_FILE_FAILED", "Failed to read file", error);
		}
	}

	/**
	 * 写入文件
	 */
	async writeFile(request: WriteFileRequest): Promise<FileOperationResponse> {
		try {
			return await this.post<FileOperationResponse>("/files/write", request);
		} catch (error) {
			throw new ServiceError(
				"WRITE_FILE_FAILED",
				"Failed to write file",
				error,
			);
		}
	}

	/**
	 * 创建目录
	 */
	async createDirectory(path: string): Promise<FileOperationResponse> {
		try {
			return await this.post<FileOperationResponse>("/files/create-directory", {
				path,
			});
		} catch (error) {
			throw new ServiceError(
				"CREATE_DIRECTORY_FAILED",
				"Failed to create directory",
				error,
			);
		}
	}

	/**
	 * 删除文件或目录
	 */
	async delete(
		path: string,
		recursive: boolean = false,
	): Promise<FileOperationResponse> {
		try {
			return await this.post<FileOperationResponse>("/files/delete", {
				path,
				recursive,
			});
		} catch (error) {
			throw new ServiceError("DELETE_FAILED", "Failed to delete", error);
		}
	}

	/**
	 * 重命名文件或目录
	 */
	async rename(
		oldPath: string,
		newPath: string,
	): Promise<FileOperationResponse> {
		try {
			return await this.post<FileOperationResponse>("/files/rename", {
				oldPath,
				newPath,
			});
		} catch (error) {
			throw new ServiceError("RENAME_FAILED", "Failed to rename", error);
		}
	}

	/**
	 * 复制文件或目录
	 */
	async copy(
		source: string,
		destination: string,
	): Promise<FileOperationResponse> {
		try {
			return await this.post<FileOperationResponse>("/files/copy", {
				source,
				destination,
			});
		} catch (error) {
			throw new ServiceError("COPY_FAILED", "Failed to copy", error);
		}
	}

	/**
	 * 移动文件或目录
	 */
	async move(
		source: string,
		destination: string,
	): Promise<FileOperationResponse> {
		try {
			return await this.post<FileOperationResponse>("/files/move", {
				source,
				destination,
			});
		} catch (error) {
			throw new ServiceError("MOVE_FAILED", "Failed to move", error);
		}
	}

	/**
	 * 执行命令
	 */
	async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
		try {
			return await this.post<ExecuteResponse>("/execute", request);
		} catch (error) {
			throw new ServiceError(
				"EXECUTE_FAILED",
				"Failed to execute command",
				error,
			);
		}
	}

	/**
	 * 搜索文件
	 */
	async searchFiles(request: SearchFilesRequest): Promise<SearchResult[]> {
		try {
			const response = await this.post<{ results: SearchResult[] }>(
				"/files/search",
				request,
			);
			return response.results;
		} catch (error) {
			throw new ServiceError(
				"SEARCH_FILES_FAILED",
				"Failed to search files",
				error,
			);
		}
	}

	/**
	 * 获取文件信息
	 */
	async getFileInfo(path: string): Promise<
		FileItem & {
			created: string;
			accessed: string;
			owner?: string;
			group?: string;
			mimeType?: string;
		}
	> {
		try {
			return await this.post("/files/info", { path });
		} catch (error) {
			throw new ServiceError(
				"GET_FILE_INFO_FAILED",
				"Failed to get file info",
				error,
			);
		}
	}

	/**
	 * 上传文件
	 */
	async uploadFile(
		path: string,
		file: File | Blob,
		onProgress?: (progress: number) => void,
	): Promise<FileOperationResponse> {
		try {
			// 注意：这里需要特殊处理文件上传
			// 实际实现中会使用FormData
			const formData = new FormData();
			formData.append("file", file);
			formData.append("path", path);

			// 模拟进度
			if (onProgress) {
				for (let i = 0; i <= 100; i += 10) {
					setTimeout(() => onProgress(i), i * 10);
				}
			}

			return await this.post<FileOperationResponse>("/files/upload", formData);
		} catch (error) {
			throw new ServiceError("UPLOAD_FAILED", "Failed to upload file", error);
		}
	}

	/**
	 * 下载文件
	 */
	async downloadFile(path: string): Promise<Blob> {
		try {
			const response = await fetch(
				`/api/files/download?path=${encodeURIComponent(path)}`,
			);
			if (!response.ok) {
				throw new Error(`Download failed: ${response.statusText}`);
			}
			return await response.blob();
		} catch (error) {
			throw new ServiceError(
				"DOWNLOAD_FAILED",
				"Failed to download file",
				error,
			);
		}
	}

	/**
	 * 获取目录树
	 */
	async getDirectoryTree(
		path: string,
		maxDepth: number = 3,
		includePatterns?: string[],
		excludePatterns?: string[],
	): Promise<any> {
		try {
			return await this.post("/files/tree", {
				path,
				maxDepth,
				includePatterns,
				excludePatterns,
			});
		} catch (error) {
			throw new ServiceError(
				"GET_TREE_FAILED",
				"Failed to get directory tree",
				error,
			);
		}
	}

	/**
	 * 批量操作
	 */
	async batchOperation(
		operations: Array<{
			type: "delete" | "copy" | "move" | "rename";
			source: string;
			destination?: string;
		}>,
	): Promise<Array<FileOperationResponse>> {
		try {
			const response = await this.post<{ results: FileOperationResponse[] }>(
				"/files/batch",
				{ operations },
			);
			return response.results;
		} catch (error) {
			throw new ServiceError(
				"BATCH_OPERATION_FAILED",
				"Failed to perform batch operation",
				error,
			);
		}
	}

	/**
	 * 获取磁盘使用情况
	 */
	async getDiskUsage(path?: string): Promise<{
		total: number;
		used: number;
		free: number;
		percentage: number;
		path: string;
	}> {
		try {
			const params = path ? { path } : {};
			return await this.get("/files/disk-usage", params);
		} catch (error) {
			throw new ServiceError(
				"GET_DISK_USAGE_FAILED",
				"Failed to get disk usage",
				error,
			);
		}
	}
}

// 导出单例
export const fileService = new FileService();
