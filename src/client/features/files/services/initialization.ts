/**
 * Initialization Service - 文件功能初始化
 *
 * 职责：处理文件功能的初始化逻辑（纯业务逻辑，不直接调用 API）
 * - 路径恢复
 * - 服务器工作目录获取
 *
 * 注意：持久化状态通过 Zustand store 自动管理，不再直接读取 localStorage
 */

import { useFileStore } from "@/features/files/stores";
import { checkPathExists, getServerWorkingDir } from "./api/fileApi";

/**
 * 初始化文件浏览器路径
 *
 * 流程：
 * 1. 从 fileStore 获取已恢复的路径（Zustand persist 自动从 localStorage 恢复）
 * 2. 检查路径是否仍然有效
 * 3. 如果无效，使用服务器当前目录
 */
export async function initializeFilePath(): Promise<string> {
	// 从 fileStore 获取当前路径（已经由 Zustand persist 从 localStorage 恢复）
	const { workingDir } = useFileStore.getState();

	// 如果有持久化的路径，检查是否还存在
	if (workingDir && workingDir !== "/root") {
		const exists = await checkPathExists(workingDir);
		if (exists) {
			console.log("[Init] Using persisted path:", workingDir);
			return workingDir;
		}
		console.log("[Init] Persisted path no longer exists:", workingDir);
	}

	// 使用服务器当前目录
	const serverDir = await getServerWorkingDir();
	console.log("[Init] Using server working dir:", serverDir);
	return serverDir;
}

/**
 * 获取初始路径（同步版本，用于 SSR 兼容）
 *
 * 注意：此函数仅返回 store 中的当前值，不验证路径有效性
 */
export function getInitialPath(): string {
	if (typeof window === "undefined") return "/root";
	return useFileStore.getState().workingDir;
}
