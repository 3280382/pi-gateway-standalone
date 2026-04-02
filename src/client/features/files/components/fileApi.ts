/**
 * FileBrowser API - HTTP Client for File Operations
 */

import { fetchApi } from "@/services/api/client";
import type {
	BrowseResponse,
	FileExecuteResponse,
	FileItem,
	FileReadResponse,
	FileWriteResponse,
} from "./types";

// ============================================================================
// API Functions
// ============================================================================

/**
 * Browse directory contents
 */
export async function browseDirectory(path: string): Promise<FileItem[]> {
	const encodedPath = encodeURIComponent(path);
	const response = await fetchApi<BrowseResponse>(
		`/browse?path=${encodedPath}`,
	);

	return response.files.map((file) => ({
		name: file.name,
		path: file.path,
		type: file.type,
		size: file.size,
		modified: new Date(file.modified),
		extension: file.type === "file" ? getExtension(file.name) : undefined,
	}));
}

/**
 * Read file content
 */
export async function readFile(
	path: string,
): Promise<{ content: string; language?: string }> {
	const encodedPath = encodeURIComponent(path);
	const response = await fetchApi<FileReadResponse>(
		`/file/read?path=${encodedPath}`,
	);

	return {
		content: response.content,
		language: detectLanguage(path),
	};
}

/**
 * Write file content
 */
export async function writeFile(path: string, content: string): Promise<void> {
	await fetchApi<FileWriteResponse>("/file/write", {
		method: "POST",
		body: JSON.stringify({ path, content }),
	});
}

/**
 * Execute file (sh/py/js)
 */
export async function executeFile(path: string): Promise<{
	stdout: string;
	stderr: string;
	exitCode: number;
	duration: number;
}> {
	const startTime = Date.now();
	const encodedPath = encodeURIComponent(path);
	const response = await fetchApi<FileExecuteResponse>(
		`/file/execute?path=${encodedPath}`,
	);
	const duration = Date.now() - startTime;

	return {
		stdout: response.stdout,
		stderr: response.stderr,
		exitCode: response.exitCode,
		duration,
	};
}

/**
 * Delete file(s)
 */
export async function deleteFiles(paths: string[]): Promise<void> {
	await fetchApi("/file/delete", {
		method: "POST",
		body: JSON.stringify({ paths }),
	});
}

// ============================================================================
// Utility Functions
// ============================================================================

function getExtension(filename: string): string {
	const dotIndex = filename.lastIndexOf(".");
	return dotIndex > 0 ? filename.slice(dotIndex + 1).toLowerCase() : "";
}

function detectLanguage(path: string): string | undefined {
	const ext = getExtension(path);

	const languageMap: Record<string, string> = {
		// JavaScript/TypeScript
		js: "javascript",
		jsx: "jsx",
		ts: "typescript",
		tsx: "tsx",
		mjs: "javascript",
		cjs: "javascript",

		// Web
		html: "html",
		htm: "html",
		css: "css",
		scss: "scss",
		sass: "sass",
		less: "less",

		// Python
		py: "python",
		pyw: "python",
		pyi: "python",

		// Shell
		sh: "bash",
		bash: "bash",
		zsh: "bash",
		fish: "fish",

		// Data
		json: "json",
		yaml: "yaml",
		yml: "yaml",
		xml: "xml",
		csv: "csv",

		// Config
		toml: "toml",
		ini: "ini",
		conf: "ini",
		cfg: "ini",
		env: "bash",

		// Markdown
		md: "markdown",
		mdx: "markdown",

		// Other languages
		rs: "rust",
		go: "go",
		java: "java",
		kt: "kotlin",
		scala: "scala",
		rb: "ruby",
		php: "php",
		c: "c",
		cpp: "cpp",
		cc: "cpp",
		h: "c",
		hpp: "cpp",
		cs: "csharp",
		swift: "swift",
		dart: "dart",
		lua: "lua",
		r: "r",
		sql: "sql",
		ps1: "powershell",
		bat: "batch",
		cmd: "batch",
		dockerfile: "dockerfile",
		make: "makefile",
		makefile: "makefile",
		vue: "vue",
		svelte: "svelte",
	};

	return languageMap[ext];
}

// ============================================================================
// File Type Helpers
// ============================================================================

export function isExecutableFile(path: string): boolean {
	const ext = getExtension(path);
	return ["sh", "py", "js", "mjs", "cjs", "bash", "zsh"].includes(ext);
}

export function isEditableFile(path: string): boolean {
	const ext = getExtension(path);
	const editableExtensions = [
		"js",
		"jsx",
		"ts",
		"tsx",
		"html",
		"htm",
		"css",
		"scss",
		"sass",
		"less",
		"py",
		"sh",
		"bash",
		"zsh",
		"json",
		"yaml",
		"yml",
		"xml",
		"csv",
		"toml",
		"ini",
		"conf",
		"cfg",
		"md",
		"mdx",
		"rs",
		"go",
		"java",
		"kt",
		"scala",
		"rb",
		"php",
		"c",
		"cpp",
		"cc",
		"h",
		"hpp",
		"cs",
		"swift",
		"dart",
		"lua",
		"r",
		"sql",
		"ps1",
		"bat",
		"cmd",
		"dockerfile",
		"vue",
		"svelte",
		"txt",
		"env",
		"log",
		"gitignore",
		"gitattributes",
		"editorconfig",
	];

	return editableExtensions.includes(ext) || !ext;
}

export function isViewableFile(path: string): boolean {
	return isEditableFile(path);
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";

	const units = ["B", "KB", "MB", "GB", "TB"];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(1))} ${units[i]}`;
}

export function formatDate(date: Date): string {
	const now = new Date();
	const diff = now.getTime() - date.getTime();

	// Less than a minute
	if (diff < 60000) {
		return "Just now";
	}

	// Less than an hour
	if (diff < 3600000) {
		const minutes = Math.floor(diff / 60000);
		return `${minutes}m ago`;
	}

	// Less than a day
	if (diff < 86400000) {
		const hours = Math.floor(diff / 3600000);
		return `${hours}h ago`;
	}

	// Less than a week
	if (diff < 604800000) {
		const days = Math.floor(diff / 86400000);
		return `${days}d ago`;
	}

	// Default to locale date string
	return date.toLocaleDateString();
}
