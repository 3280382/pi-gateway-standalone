/**
 * Initialization Service - 文件功能初始化
 *
 * 职责：处理文件功能的初始化逻辑
 * - 路径恢复
 * - 服务器工作目录获取
 */

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

// 检查路径是否存在
async function checkPathExists(path: string): Promise<boolean> {
	try {
		const response = await fetch("/api/browse", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path }),
		});
		return response.ok;
	} catch {
		return false;
	}
}

// 初始化文件浏览器路径
export async function initializeFilePath(): Promise<string> {
	const persistedPath = getPersistedPath();

	// 如果有持久化的路径，检查是否还存在
	if (persistedPath) {
		const exists = await checkPathExists(persistedPath);
		if (exists) {
			console.log("[FileStore] Using persisted path:", persistedPath);
			return persistedPath;
		}
		console.log("[FileStore] Persisted path no longer exists:", persistedPath);
	}

	// 使用服务器当前目录
	try {
		const response = await fetch("/api/working-dir");
		if (response.ok) {
			const data = await response.json();
			if (data.cwd) {
				console.log("[FileStore] Using server working dir:", data.cwd);
				return data.cwd;
			}
		}
	} catch (error) {
		console.error("[FileStore] Failed to get server working dir:", error);
	}

	// 默认路径
	console.log("[FileStore] Using default path: /root");
	return "/root";
}
