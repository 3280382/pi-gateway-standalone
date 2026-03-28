/**
 * 会话工具函数
 */

import { homedir } from "os";
import { join } from "path";

// 常量定义
export const AGENT_DIR = join(homedir(), ".pi", "agent");

/**
 * 编码工作目录为安全的目录名（如pi coding agent所做）
 */
export function encodeCwd(cwd: string): string {
	// 移除前导斜杠并用破折号替换路径分隔符
	return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}

/**
 * 获取工作目录的会话目录（pi coding agent标准）
 */
export function getLocalSessionsDir(workingDir: string): string {
	const encodedDir = encodeCwd(workingDir);
	return join(AGENT_DIR, "sessions", encodedDir);
}

/**
 * 扩展路径（处理~和相对路径）
 */
export function expandPath(path: string): string {
	if (path.startsWith("~")) {
		return join(homedir(), path.slice(1));
	}
	if (!path.startsWith("/")) {
		return join(process.cwd(), path);
	}
	return path;
}

/**
 * 提取会话ID从会话文件路径
 */
export function extractSessionIdFromPath(sessionPath: string): string {
	const fileName = sessionPath.split("/").pop() || "";
	return fileName.replace(".jsonl", "");
}

/**
 * 生成安全的文件名
 */
export function safeFileName(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9._-]/g, "_")
		.replace(/_{2,}/g, "_")
		.replace(/^_+|_+$/g, "");
}
