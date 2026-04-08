/**
 * useFileViewer - 文件查看器业务逻辑 Hook
 *
 * 职责：管理文件查看器的所有业务逻辑
 * - 文件类型判断
 * - 加载文件内容
 * - 保存文件
 * - 执行文件
 * - 复制路径
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	executeFile,
	getRawFileUrl,
	readFile,
	writeFile,
} from "@/features/files/services/api/fileApi";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { fileViewerDebug } from "@/lib/debug";

// 文件类型配置
const FILE_TYPES = {
	image: [
		"png",
		"jpg",
		"jpeg",
		"gif",
		"svg",
		"webp",
		"ico",
		"bmp",
		"tiff",
		"tif",
	],
	html: ["html", "htm"],
	markdown: ["md", "markdown"],
	code: [
		"js",
		"ts",
		"jsx",
		"tsx",
		"py",
		"java",
		"c",
		"cpp",
		"h",
		"hpp",
		"cs",
		"go",
		"rs",
		"php",
		"rb",
		"pl",
		"sh",
		"bash",
		"zsh",
		"ps1",
		"bat",
		"cmd",
	],
	json: ["json"],
	xml: ["xml", "xsl", "xslt"],
	yaml: ["yaml", "yml"],
	css: ["css", "scss", "sass", "less"],
	sql: ["sql"],
	executable: [
		"sh",
		"py",
		"js",
		"ts",
		"bash",
		"zsh",
		"pl",
		"rb",
		"php",
		"go",
		"java",
		"c",
		"cpp",
		"rs",
	],
	nonEditable: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"],
};

// 语言映射 - 用于 Prism.js (查看模式) 和 CodeMirror (编辑模式)
const LANG_MAP: Record<string, string> = {
	// JavaScript/TypeScript - Prism 和 CodeMirror 都使用这些标识
	js: "javascript",
	ts: "typescript",
	jsx: "jsx",
	tsx: "tsx",
	// 其他语言
	py: "python",
	java: "java",
	c: "c",
	cpp: "cpp",
	h: "c",
	hpp: "cpp",
	cs: "csharp",
	go: "go",
	rs: "rust",
	php: "php",
	rb: "ruby",
	pl: "perl",
	swift: "swift",
	kt: "kotlin",
	scala: "scala",
	lua: "lua",
	r: "r",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	ps1: "powershell",
	bat: "batch",
	cmd: "batch",
	html: "html",
	htm: "html",
	xml: "xml",
	xsl: "xml",
	xslt: "xml",
	md: "markdown",
	markdown: "markdown",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	css: "css",
	scss: "scss",
	sass: "sass",
	less: "less",
	sql: "sql",
};

// Prism.js 语言映射 - 用于查看模式（某些语言需要映射到 Prism 支持的名字）
const PRISM_LANG_MAP: Record<string, string> = {
	tsx: "typescript", // Prism 使用 typescript 来高亮 TSX
	jsx: "javascript", // Prism 使用 javascript 来高亮 JSX
};

export interface FileTypeInfo {
	isImage: boolean;
	isHtml: boolean;
	isMarkdown: boolean;
	isCode: boolean;
	isJson: boolean;
	isXml: boolean;
	isYaml: boolean;
	isCss: boolean;
	isSql: boolean;
	isExecutable: boolean;
	isEditable: boolean;
	extension: string;
	language: string;
	getRawFileUrl: (path: string) => string;
}

export interface UseFileViewerResult {
	// 文件类型信息
	fileTypes: FileTypeInfo;

	// 操作方法
	loadFile: () => Promise<void>;
	saveFile: () => Promise<void>;
	execute: () => Promise<void>;
	copyPath: () => Promise<void>;
	getLanguage: () => string;
	stopExecution: () => void;
}

export function useFileViewer(): UseFileViewerResult {
	const {
		isOpen,
		filePath,
		fileName,
		mode,
		editedContent,
		setContent,
		setLoading,
		setError,
		setMode,
		setSaving,
		setExecuting,
		appendTerminalOutput,
		clearTerminal,
	} = useFileViewerStore();

	const abortRef = useRef<AbortController | null>(null);

	// 文件扩展名
	const ext = useMemo(
		() => fileName.split(".").pop()?.toLowerCase() || "",
		[fileName],
	);

	// 文件类型判断
	const fileTypes = useMemo<FileTypeInfo>(() => {
		const isImage = FILE_TYPES.image.includes(ext);
		const isHtml = FILE_TYPES.html.includes(ext);
		const isMarkdown = FILE_TYPES.markdown.includes(ext);
		const isCode = FILE_TYPES.code.includes(ext);
		const isJson = FILE_TYPES.json.includes(ext);
		const isXml = FILE_TYPES.xml.includes(ext);
		const isYaml = FILE_TYPES.yaml.includes(ext);
		const isCss = FILE_TYPES.css.includes(ext);
		const isSql = FILE_TYPES.sql.includes(ext);
		const isExecutable = FILE_TYPES.executable.includes(ext);
		const isEditable = !isImage && !FILE_TYPES.nonEditable.includes(ext);

		return {
			isImage,
			isHtml,
			isMarkdown,
			isCode,
			isJson,
			isXml,
			isYaml,
			isCss,
			isSql,
			isExecutable,
			isEditable,
			extension: ext,
			language: LANG_MAP[ext] || "text",
			getRawFileUrl,
		};
	}, [ext]);

	// 加载文件内容
	const loadFile = useCallback(async () => {
		if (!isOpen || !filePath || mode === "execute") return;

		fileViewerDebug.info("开始加载文件", { filePath, mode });
		setLoading(true);
		setError(null);

		try {
			const data = await readFile(filePath);
			fileViewerDebug.info("文件加载成功", {
				filePath,
				contentLength: data.content?.length,
			});
			setContent(data.content);
		} catch (err) {
			fileViewerDebug.error("文件加载失败", {
				filePath,
				error: err instanceof Error ? err.message : String(err),
			});
			setError(err instanceof Error ? err.message : "Failed to load file");
		} finally {
			setLoading(false);
		}
	}, [isOpen, filePath, mode, setContent, setLoading, setError]);

	// 保存文件
	const saveFile = useCallback(async () => {
		if (!filePath) return;

		setSaving(true);
		try {
			await writeFile(filePath, editedContent);
			setContent(editedContent);
			setMode("view");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save file");
		} finally {
			setSaving(false);
		}
	}, [filePath, editedContent, setContent, setMode, setSaving, setError]);

	// 执行文件
	const execute = useCallback(async () => {
		if (!filePath) return;

		clearTerminal();
		setExecuting(true);
		abortRef.current = new AbortController();

		try {
			const stream = await executeFile(filePath);
			const reader = stream.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const text = decoder.decode(value, { stream: true });
				appendTerminalOutput(text);
			}
		} catch (err) {
			appendTerminalOutput(
				`\nError: ${err instanceof Error ? err.message : "Execution failed"}`,
			);
		} finally {
			setExecuting(false);
		}
	}, [filePath, clearTerminal, setExecuting, appendTerminalOutput]);

	// 复制路径
	const copyPath = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(filePath);
			fileViewerDebug.info("路径已复制", { filePath });
		} catch (err) {
			fileViewerDebug.error("复制路径失败", { error: err });
		}
	}, [filePath]);

	// 停止执行
	const stopExecution = useCallback(() => {
		abortRef.current?.abort();
	}, []);

	// 获取语言
	const getLanguage = useCallback(() => LANG_MAP[ext] || "text", [ext]);

	// 加载文件副作用
	useEffect(() => {
		loadFile();
	}, [loadFile]);

	// 清理副作用
	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	return {
		fileTypes,
		loadFile,
		saveFile,
		execute,
		copyPath,
		getLanguage,
		stopExecution,
	};
}
