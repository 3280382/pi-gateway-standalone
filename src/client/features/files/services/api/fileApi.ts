/**
 * File API - 文件操作
 */

import type { FileItem } from "@/features/files/stores/fileStore";

export interface BrowseResponse {
	currentPath: string;
	parentPath: string;
	items: FileItem[];
}

export interface FileContentResponse {
	path: string;
	content: string;
	size: number;
	modified: string;
}

export interface FileReadResponse {
	path: string;
	content: string;
}

export interface FileExecuteResponse {
	stdout: string;
	stderr: string;
	exitCode: number;
}

export interface TreeNode {
	name: string;
	path: string;
	isDirectory: boolean;
	children?: TreeNode[];
	truncated?: boolean;
}

export interface TreeResponse {
	path: string;
	items: TreeNode[];
}

// 浏览目录
export async function browseDirectory(path: string): Promise<BrowseResponse> {
	const response = await fetch("/api/browse", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path }),
	});

	if (!response.ok) {
		throw new Error(`Failed to browse directory: ${response.statusText}`);
	}

	return response.json();
}

// 获取文件树
export async function getFileTree(path: string): Promise<TreeResponse> {
	const response = await fetch(
		`/api/files/tree?path=${encodeURIComponent(path)}`,
	);

	if (!response.ok) {
		throw new Error(`Failed to load file tree: ${response.statusText}`);
	}

	const data = await response.json();

	// API returns nested tree structure with children, flatten it for UI
	const items: TreeNode[] = [];
	const rootPath = data.path || "";

	function flatten(node: TreeNode, depth: number = 0) {
		// Skip the root node itself, only include children
		if (depth > 0) {
			// Get relative path from root
			const relativePath = node.path.replace(rootPath, "").replace(/^\//, "");
			items.push({
				name: node.name,
				path: relativePath || node.name,
				isDirectory: node.isDirectory,
			});
		}
		if (node.children && !node.truncated) {
			for (const child of node.children) {
				flatten(child, depth + 1);
			}
		}
	}

	// data is the root node
	if (data) {
		flatten(data, 0);
	}

	return { path: data.path || path, items };
}

// 读取文件内容
export async function readFile(path: string): Promise<FileContentResponse> {
	const response = await fetch(
		`/api/files/content?path=${encodeURIComponent(path)}`,
	);

	if (!response.ok) {
		throw new Error(`Failed to read file: ${response.statusText}`);
	}

	return response.json();
}

// 写入文件
export async function writeFile(path: string, content: string): Promise<void> {
	const response = await fetch("/api/files/write", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path, content }),
	});

	if (!response.ok) {
		throw new Error(`Failed to write file: ${response.statusText}`);
	}
}

// 获取原始文件（图片等）
export function getRawFileUrl(path: string): string {
	return `/api/files/raw?path=${encodeURIComponent(path)}`;
}

// 执行文件
export async function executeFile(
	path: string,
): Promise<ReadableStream<Uint8Array>> {
	// 获取文件所在目录作为工作目录
	const dir = path.split("/").slice(0, -1).join("/") || "/";
	const fileName = path.split("/").pop() || "";

	// 构建执行命令
	let command = `./${fileName}`;

	// 根据文件类型调整命令
	if (fileName.endsWith(".py")) {
		command = `python3 "${path}"`;
	} else if (fileName.endsWith(".js")) {
		command = `node "${path}"`;
	} else if (fileName.endsWith(".sh") || fileName.endsWith(".bash")) {
		command = `bash "${path}"`;
	}

	const response = await fetch("/api/execute", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			command: command,
			cwd: dir,
			streaming: true,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to execute file: ${response.statusText}`);
	}

	if (!response.body) {
		throw new Error("No response body");
	}

	return response.body;
}

// 格式化文件大小
export function formatFileSize(bytes?: number): string {
	if (bytes === undefined || bytes === null) return "-";
	if (bytes === 0) return "0 B";

	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

// 获取文件图标
export function getFileIcon(extension?: string, isDirectory?: boolean): string {
	if (isDirectory) return "📁";

	const iconMap: Record<string, string> = {
		js: "📜",
		ts: "📘",
		jsx: "⚛️",
		tsx: "⚛️",
		py: "🐍",
		java: "☕",
		go: "🐹",
		rs: "🦀",
		html: "🌐",
		css: "🎨",
		json: "📋",
		md: "📝",
		txt: "📄",
		png: "🖼️",
		jpg: "🖼️",
		jpeg: "🖼️",
		gif: "🖼️",
		svg: "🖼️",
		pdf: "📕",
		zip: "📦",
		tar: "📦",
		gz: "📦",
	};

	return iconMap[extension?.toLowerCase() || ""] || "📄";
}

// 获取文件扩展名
export function getFileExtension(filename: string): string {
	const parts = filename.split(".");
	if (parts.length <= 1) return "";
	// Handle hidden files like .gitignore (first part is empty)
	if (parts[0] === "" && parts.length <= 2) return "";
	return parts[parts.length - 1].toLowerCase();
}

// 检查路径是否存在
export async function checkPathExists(path: string): Promise<boolean> {
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

// 获取服务器当前工作目录
export async function getServerWorkingDir(): Promise<string> {
	try {
		const response = await fetch("/api/working-dir");
		if (response.ok) {
			const data = await response.json();
			if (data.cwd) return data.cwd;
		}
	} catch (error) {
		console.error("[API] Failed to get server working dir:", error);
	}
	return "/root";
}
