/**
 * File Operations API - 文件业务操作层
 *
 * 职责：封装文件相关的业务操作 API 调用
 * 不包含状态管理，只负责与服务器通信
 */

import type { FileItem } from "@/features/files/stores/fileStore";
import { browseDirectory } from "./fileApi";

export interface DirectoryData {
	currentPath: string;
	parentPath: string;
	items: FileItem[];
}

/**
 * 加载目录内容
 */
export async function loadDirectoryContent(
	path: string,
): Promise<DirectoryData> {
	const data = await browseDirectory(path);

	const itemsToSet = [
		...(data.parentPath !== data.currentPath
			? [
					{
						name: "..",
						path: data.parentPath,
						isDirectory: true,
						modified: "",
					},
				]
			: []),
		...data.items,
	];

	return {
		currentPath: data.currentPath,
		parentPath: data.parentPath,
		items: itemsToSet,
	};
}

/**
 * 批量删除文件
 */
export async function batchDeleteFiles(paths: string[]): Promise<void> {
	if (paths.length === 0) return;

	const response = await fetch("/api/files/batch-delete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ paths }),
	});

	if (!response.ok) {
		throw new Error("Failed to delete files");
	}
}

/**
 * 批量移动文件
 */
export async function batchMoveFiles(
	paths: string[],
	targetPath: string,
): Promise<void> {
	if (paths.length === 0) return;

	const response = await fetch("/api/files/batch-move", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ paths, targetPath }),
	});

	if (!response.ok) {
		throw new Error("Failed to move files");
	}
}

/**
 * 创建新文件
 */
export async function createFile(
	currentPath: string,
	fileName: string,
): Promise<void> {
	const filePath = `${currentPath}/${fileName}`.replace(/\/+/g, "/");

	const response = await fetch("/api/files/write", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path: filePath, content: "" }),
	});

	if (!response.ok) {
		throw new Error("Failed to create file");
	}
}

/**
 * 执行文件
 */
export async function executeFileByPath(
	path: string,
	onOutput?: (output: string) => void,
): Promise<string> {
	const response = await fetch("/api/execute", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path }),
	});

	if (!response.ok) {
		throw new Error("Failed to execute file");
	}

	const output = await response.text();
	if (onOutput) {
		onOutput(output);
	}
	return output;
}

/**
 * 获取友好的错误消息
 */
export function getFriendlyErrorMessage(error: unknown, path: string): string {
	const errorMessage = error instanceof Error ? error.message : String(error);

	// 权限错误
	if (
		errorMessage.includes("permission") ||
		errorMessage.includes("Permission")
	) {
		return `Permission denied: Cannot access "${path}". You may need to check file permissions.`;
	}

	// 路径不存在错误
	if (
		errorMessage.includes("ENOENT") ||
		errorMessage.includes("not exist") ||
		errorMessage.includes("not found")
	) {
		return `Directory not found: "${path}" does not exist or cannot be accessed.`;
	}

	// 网络错误
	if (
		errorMessage.includes("network") ||
		errorMessage.includes("Network") ||
		errorMessage.includes("fetch")
	) {
		return `Network error: Cannot connect to server. Please check your connection.`;
	}

	return errorMessage;
}
