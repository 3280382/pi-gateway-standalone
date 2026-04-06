/**
 * Initialization Service - 文件功能初始化
 *
 * 职责：处理文件功能的初始化逻辑（纯业务逻辑，不直接调用 API）
 * - 路径恢复
 * - 服务器工作目录获取
 */

import { checkPathExists, getServerWorkingDir } from "./api/fileApi";

// 从 localStorage 恢复的路径
export function getPersistedPath(): string | null {
	try {
		const stored = localStorage.getItem("file-storage");
		if (stored) {
			const data = JSON.parse(stored);
			return data.state?.currentPath || null;
		}
	} catch {
		// 忽略解析错误
	}
	return null;
}

// 初始化文件浏览器路径
export async function initializeFilePath(): Promise<string> {
	const persistedPath = getPersistedPath();

	// 如果有持久化的路径，检查是否还存在
	if (persistedPath) {
		const exists = await checkPathExists(persistedPath);
		if (exists) {
			console.log("[Init] Using persisted path:", persistedPath);
			return persistedPath;
		}
		console.log("[Init] Persisted path no longer exists:", persistedPath);
	}

	// 使用服务器当前目录
	const serverDir = await getServerWorkingDir();
	console.log("[Init] Using server working dir:", serverDir);
	return serverDir;
}
