/**
 * FileViewer - 文件查看器模态框
 */
import React, { useCallback, useEffect, useRef } from "react";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { fileViewerDebug } from "@/lib/debug";
import {
	executeFile,
	getRawFileUrl,
	readFile,
	writeFile,
} from "@/features/files/services/api/fileApi";
import styles from "./FileViewer.module.css";

// Prism will be loaded dynamically
export function FileViewer() {
	const {
		isOpen,
		filePath,
		fileName,
		mode,
		content,
		isLoading,
		error,
		editedContent,
		isSaving,
		terminalOutput,
		isExecuting,
		closeViewer,
		setContent,
		setLoading,
		setError,
		setMode,
		setEditedContent,
		setSaving,
		appendTerminalOutput,
		clearTerminal,
		setExecuting,
	} = useFileViewerStore();
	const terminalRef = useRef<HTMLDivElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	const ext = fileName.split(".").pop()?.toLowerCase() || "";

	// 支持的文件格式
	const isImage = [
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
	].includes(ext);
	const isHtml = ext === "html" || ext === "htm";
	const isMarkdown = ext === "md" || ext === "markdown";
	const isCode = [
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
	].includes(ext);
	const isJson = ext === "json";
	const isXml = ext === "xml" || ext === "xsl" || ext === "xslt";
	const isYaml = ext === "yaml" || ext === "yml";
	const isCss =
		ext === "css" || ext === "scss" || ext === "sass" || ext === "less";
	const isSql = ext === "sql";
	const isExecutable = [
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
	].includes(ext);
	const isEditable =
		!isImage &&
		!["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
	// 加载文件内容
	useEffect(() => {
		if (!isOpen || !filePath) return;
		if (mode === "execute") return; // 执行模式不加载内容

		fileViewerDebug.info("开始加载文件", { filePath, mode });

		let isCancelled = false;

		const load = async () => {
			// 先重置状态
			setLoading(true);
			setError(null);

			try {
				const data = await readFile(filePath);
				if (!isCancelled) {
					fileViewerDebug.info("文件加载成功", {
						filePath,
						contentLength: data.content?.length,
					});
					setContent(data.content);
				}
			} catch (err) {
				if (!isCancelled) {
					fileViewerDebug.error("文件加载失败", {
						filePath,
						error: err instanceof Error ? err.message : String(err),
					});
					setError(err instanceof Error ? err.message : "Failed to load file");
				}
			}
		};

		load();

		return () => {
			isCancelled = true;
		};
	}, [isOpen, filePath, mode]);
	// 执行文件
	useEffect(() => {
		if (!isOpen || mode !== "execute" || !filePath) return;
		const execute = async () => {
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
		};
		execute();
		return () => {
			abortRef.current?.abort();
		};
	}, [
		isOpen,
		mode,
		filePath,
		clearTerminal,
		setExecuting,
		appendTerminalOutput,
	]);
	// 自动滚动终端
	useEffect(() => {
		if (terminalRef.current) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
	}, [terminalOutput]);
	// 语法高亮 - 使用全局Prism
	useEffect(() => {
		if (mode === "view" && content && !isImage && !isHtml) {
			// 使用setTimeout确保DOM已更新
			const timer = setTimeout(() => {
				if ((window as any).Prism) {
					const codeElement = document.querySelector("[data-prism-code]");
					if (codeElement) {
						(window as any).Prism.highlightElement(codeElement);
					}
				}
			}, 10);
			return () => clearTimeout(timer);
		}
	}, [content, mode, isImage, isHtml]);
	const handleSave = async () => {
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
	};
	const getLanguage = () => {
		const langMap: Record<string, string> = {
			// 编程语言
			js: "javascript",
			ts: "typescript",
			jsx: "jsx",
			tsx: "tsx",
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

			// 脚本语言
			sh: "bash",
			bash: "bash",
			zsh: "bash",
			ps1: "powershell",
			bat: "batch",
			cmd: "batch",

			// 标记语言
			html: "html",
			htm: "html",
			xml: "xml",
			xsl: "xml",
			xslt: "xml",
			md: "markdown",
			markdown: "markdown",

			// 数据格式
			json: "json",
			yaml: "yaml",
			yml: "yaml",

			// 样式表
			css: "css",
			scss: "scss",
			sass: "sass",
			less: "less",

			// 数据库
			sql: "sql",
		};
		return langMap[ext] || "text";
	};
	if (!isOpen) {
		fileViewerDebug.debug("FileViewer未渲染 - isOpen=false");
		return null;
	}

	fileViewerDebug.info("FileViewer渲染", {
		filePath,
		fileName,
		mode,
		isLoading,
		hasError: !!error,
		contentLength: content?.length,
		contentPreview: content?.substring(0, 100),
	});

	return (
		<div className={styles.modal}>
			<div className={styles.content}>
				{/* 头部 */}
				<div className={styles.header}>
					<div className={styles.title}>
						<span>{fileName}</span>
						<span className={styles.type}>{mode.toUpperCase()}</span>
					</div>
					<div className={styles.actions}>
						{mode === "view" && isExecutable && (
							<button
								className={styles.btnExecute}
								onClick={() => setMode("execute")}
							>
								▶ Execute
							</button>
						)}
						{mode === "view" && isEditable && (
							<button
								className={styles.btnEdit}
								onClick={() => setMode("edit")}
							>
								✎ Edit
							</button>
						)}
						<button className={styles.btnClose} onClick={closeViewer}>
							✕
						</button>
					</div>
				</div>
				{/* 内容区 */}
				<div className={styles.body}>
					{isLoading ? (
						<div className={styles.loading}>Loading...</div>
					) : error ? (
						<div className={styles.error}>{error}</div>
					) : mode === "edit" ? (
						<textarea
							className={styles.editor}
							value={editedContent}
							onChange={(e) => setEditedContent(e.target.value)}
							spellCheck={false}
						/>
					) : mode === "execute" ? (
						<div className={styles.terminal} ref={terminalRef}>
							<pre>{terminalOutput}</pre>
							{isExecuting && <span className={styles.cursor}>▊</span>}
						</div>
					) : isImage ? (
						<img
							src={getRawFileUrl(filePath)}
							alt={fileName}
							className={styles.image}
						/>
					) : isHtml ? (
						<iframe
							src={getRawFileUrl(filePath)}
							title={fileName}
							className={styles.iframe}
							sandbox="allow-scripts allow-same-origin allow-forms"
						/>
					) : (
						<pre className={`${styles.code} language-${getLanguage()}`}>
							<code data-prism-code className={`language-${getLanguage()}`}>
								{typeof content === "string"
									? content
									: JSON.stringify(content, null, 2)}
							</code>
						</pre>
					)}
				</div>
				{/* 底部操作 */}
				{mode === "edit" && (
					<div className={styles.footer}>
						<button
							className={styles.btnSecondary}
							onClick={() => setMode("view")}
						>
							Cancel
						</button>
						<button
							className={styles.btnPrimary}
							onClick={handleSave}
							disabled={isSaving}
						>
							{isSaving ? "Saving..." : "Save"}
						</button>
					</div>
				)}
				{mode === "execute" && (
					<div className={styles.footer}>
						<button className={styles.btnSecondary} onClick={clearTerminal}>
							Clear
						</button>
						<button
							className={styles.btnDanger}
							onClick={() => abortRef.current?.abort()}
							disabled={!isExecuting}
						>
							Stop
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
