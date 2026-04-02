/**
 * File Controller - 连接Service层和Store层
 * 处理文件相关的业务逻辑
 */

import { ServiceError } from "@/shared/services/base.service";
import type {
	BrowseResponse,
	ExecuteResponse,
	FileContentResponse,
} from "@/shared/services/file.service";
import { fileService } from "@/shared/services/file.service";

export class FileController {
	private currentPath: string = "";
	private fileCache: Map<string, BrowseResponse> = new Map();
	private fileContentCache: Map<string, FileContentResponse> = new Map();

	/**
	 * 浏览目录
	 */
	async browse(path?: string): Promise<BrowseResponse> {
		try {
			// 检查缓存
			const cacheKey = path || "root";
			const cached = this.fileCache.get(cacheKey);

			if (cached && this.isCacheValid(cacheKey)) {
				console.log(
					`[FileController] Using cached browse data for: ${cacheKey}`,
				);
				this.currentPath = cached.currentPath;
				return cached;
			}

			// 从服务获取
			console.log(
				`[FileController] Fetching browse data for: ${path || "root"}`,
			);
			const response = await fileService.browse(path);
			this.currentPath = response.currentPath;

			// 更新缓存
			this.fileCache.set(cacheKey, response);
			this.updateCacheTimestamp(cacheKey);

			return response;
		} catch (error) {
			this.handleError("browse", error);
			throw error;
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
			// 检查缓存
			const cacheKey = `${path}:${encoding}`;
			const cached = this.fileContentCache.get(cacheKey);

			if (cached && this.isCacheValid(cacheKey)) {
				console.log(`[FileController] Using cached file content for: ${path}`);
				return cached;
			}

			// 从服务获取
			console.log(`[FileController] Reading file: ${path}`);
			const content = await fileService.readFile(path, encoding);

			// 更新缓存
			this.fileContentCache.set(cacheKey, content);
			this.updateCacheTimestamp(cacheKey);

			return content;
		} catch (error) {
			this.handleError("readFile", error);
			throw error;
		}
	}

	/**
	 * 写入文件
	 */
	async writeFile(path: string, content: string): Promise<void> {
		try {
			console.log(`[FileController] Writing file: ${path}`);
			await fileService.writeFile({ path, content });

			// 清除相关缓存
			this.invalidateCacheForPath(path);
			this.fileContentCache.delete(path);
		} catch (error) {
			this.handleError("writeFile", error);
			throw error;
		}
	}

	/**
	 * 创建目录
	 */
	async createDirectory(path: string): Promise<void> {
		try {
			console.log(`[FileController] Creating directory: ${path}`);
			await fileService.createDirectory(path);

			// 清除相关缓存
			this.invalidateCacheForPath(path);
		} catch (error) {
			this.handleError("createDirectory", error);
			throw error;
		}
	}

	/**
	 * 删除文件或目录
	 */
	async delete(path: string, recursive: boolean = false): Promise<void> {
		try {
			console.log(
				`[FileController] Deleting: ${path} ${recursive ? "(recursive)" : ""}`,
			);
			await fileService.delete(path, recursive);

			// 清除相关缓存
			this.invalidateCacheForPath(path);
			this.fileContentCache.delete(path);
		} catch (error) {
			this.handleError("delete", error);
			throw error;
		}
	}

	/**
	 * 重命名文件或目录
	 */
	async rename(oldPath: string, newPath: string): Promise<void> {
		try {
			console.log(`[FileController] Renaming: ${oldPath} -> ${newPath}`);
			await fileService.rename(oldPath, newPath);

			// 清除相关缓存
			this.invalidateCacheForPath(oldPath);
			this.invalidateCacheForPath(newPath);
			this.fileContentCache.delete(oldPath);
		} catch (error) {
			this.handleError("rename", error);
			throw error;
		}
	}

	/**
	 * 复制文件或目录
	 */
	async copy(source: string, destination: string): Promise<void> {
		try {
			console.log(`[FileController] Copying: ${source} -> ${destination}`);
			await fileService.copy(source, destination);

			// 清除相关缓存
			this.invalidateCacheForPath(destination);
		} catch (error) {
			this.handleError("copy", error);
			throw error;
		}
	}

	/**
	 * 移动文件或目录
	 */
	async move(source: string, destination: string): Promise<void> {
		try {
			console.log(`[FileController] Moving: ${source} -> ${destination}`);
			await fileService.move(source, destination);

			// 清除相关缓存
			this.invalidateCacheForPath(source);
			this.invalidateCacheForPath(destination);
			this.fileContentCache.delete(source);
		} catch (error) {
			this.handleError("move", error);
			throw error;
		}
	}

	/**
	 * 执行命令
	 */
	async execute(
		command: string,
		workingDir?: string,
		streaming: boolean = false,
	): Promise<ExecuteResponse> {
		try {
			console.log(
				`[FileController] Executing command: ${command} in ${workingDir || "current directory"}`,
			);

			const response = await fileService.execute({
				command,
				workingDir: workingDir || this.currentPath,
				streaming,
			});

			return response;
		} catch (error) {
			this.handleError("execute", error);
			throw error;
		}
	}

	/**
	 * 搜索文件
	 */
	async searchFiles(
		query: string,
		options?: {
			path?: string;
			extensions?: string[];
			maxResults?: number;
			recursive?: boolean;
		},
	): Promise<any[]> {
		try {
			console.log(`[FileController] Searching files: ${query}`);

			const results = await fileService.searchFiles({
				query,
				path: options?.path || this.currentPath,
				extensions: options?.extensions,
				maxResults: options?.maxResults || 100,
				recursive: options?.recursive || false,
			});

			return results;
		} catch (error) {
			this.handleError("searchFiles", error);
			throw error;
		}
	}

	/**
	 * 获取文件信息
	 */
	async getFileInfo(path: string): Promise<any> {
		try {
			console.log(`[FileController] Getting file info: ${path}`);
			return await fileService.getFileInfo(path);
		} catch (error) {
			this.handleError("getFileInfo", error);
			throw error;
		}
	}

	/**
	 * 上传文件
	 */
	async uploadFile(
		path: string,
		file: File,
		onProgress?: (progress: number) => void,
	): Promise<void> {
		try {
			console.log(`[FileController] Uploading file to: ${path}`);
			await fileService.uploadFile(path, file, onProgress);

			// 清除相关缓存
			this.invalidateCacheForPath(path);
		} catch (error) {
			this.handleError("uploadFile", error);
			throw error;
		}
	}

	/**
	 * 下载文件
	 */
	async downloadFile(path: string): Promise<void> {
		try {
			console.log(`[FileController] Downloading file: ${path}`);
			const blob = await fileService.downloadFile(path);

			// 创建下载链接
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = path.split("/").pop() || "download";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			this.handleError("downloadFile", error);
			throw error;
		}
	}

	/**
	 * 获取目录树
	 */
	async getDirectoryTree(path: string, maxDepth: number = 3): Promise<any> {
		try {
			console.log(
				`[FileController] Getting directory tree: ${path} (depth: ${maxDepth})`,
			);
			return await fileService.getDirectoryTree(path, maxDepth);
		} catch (error) {
			this.handleError("getDirectoryTree", error);
			throw error;
		}
	}

	/**
	 * 批量操作
	 */
	async batchOperations(
		operations: Array<{
			type: "delete" | "copy" | "move" | "rename";
			source: string;
			destination?: string;
		}>,
	): Promise<void> {
		try {
			console.log(
				`[FileController] Performing batch operations: ${operations.length} operations`,
			);

			const results = await fileService.batchOperation(operations);

			// 检查结果
			const failed = results.filter((r) => !r.success);
			if (failed.length > 0) {
				throw new ServiceError(
					"BATCH_OPERATION_PARTIAL_FAILURE",
					`${failed.length} operations failed`,
					failed,
				);
			}

			// 清除相关缓存
			operations.forEach((op) => {
				this.invalidateCacheForPath(op.source);
				if (op.destination) {
					this.invalidateCacheForPath(op.destination);
				}
				if (
					op.type === "delete" ||
					op.type === "move" ||
					op.type === "rename"
				) {
					this.fileContentCache.delete(op.source);
				}
			});
		} catch (error) {
			this.handleError("batchOperations", error);
			throw error;
		}
	}

	/**
	 * 获取磁盘使用情况
	 */
	async getDiskUsage(path?: string): Promise<any> {
		try {
			console.log(
				`[FileController] Getting disk usage for: ${path || "current path"}`,
			);
			return await fileService.getDiskUsage(path || this.currentPath);
		} catch (error) {
			this.handleError("getDiskUsage", error);
			throw error;
		}
	}

	/**
	 * 获取当前路径
	 */
	getCurrentPath(): string {
		return this.currentPath;
	}

	/**
	 * 设置当前路径
	 */
	setCurrentPath(path: string): void {
		this.currentPath = path;
	}

	/**
	 * 清除缓存
	 */
	clearCache(): void {
		console.log("[FileController] Clearing cache");
		this.fileCache.clear();
		this.fileContentCache.clear();
	}

	/**
	 * 检查缓存是否有效
	 */
	private isCacheValid(cacheKey: string): boolean {
		// 简单的缓存验证：缓存5分钟
		const cacheData = this.fileCache.get(cacheKey);
		if (!cacheData) return false;

		const cacheTimestamp = (cacheData as any)._timestamp;
		if (!cacheTimestamp) return false;

		const age = Date.now() - cacheTimestamp;
		return age < 5 * 60 * 1000; // 5分钟
	}

	/**
	 * 更新缓存时间戳
	 */
	private updateCacheTimestamp(cacheKey: string): void {
		const cacheData = this.fileCache.get(cacheKey);
		if (cacheData) {
			(cacheData as any)._timestamp = Date.now();
		}

		const contentData = this.fileContentCache.get(cacheKey);
		if (contentData) {
			(contentData as any)._timestamp = Date.now();
		}
	}

	/**
	 * 使路径相关的缓存失效
	 */
	private invalidateCacheForPath(path: string): void {
		// 使包含该路径的所有缓存失效
		for (const [key] of this.fileCache) {
			if (key.includes(path) || path.includes(key)) {
				this.fileCache.delete(key);
			}
		}

		// 使父目录缓存失效
		const parentDir = path.split("/").slice(0, -1).join("/");
		if (parentDir) {
			this.fileCache.delete(parentDir);
		}
	}

	/**
	 * 处理错误
	 */
	private handleError(method: string, error: any): void {
		console.error(`[FileController.${method}] Error:`, error);

		// 这里可以添加更详细的错误处理逻辑
		// 例如：显示错误通知、记录错误日志等
	}
}

// 导出单例
export const fileController = new FileController();
