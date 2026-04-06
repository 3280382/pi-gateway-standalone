/**
 * FileViewer - 文件查看器模态框
 *
 * 职责：纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useFileViewer hook 获取所有逻辑
 */

import React, { useEffect, useRef } from "react";
import { useFileViewer } from "@/features/files/hooks";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { fileViewerDebug } from "@/lib/debug";
import styles from "./FileViewer.module.css";

export function FileViewer() {
	// 从 store 获取状态
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
		setMode,
		setEditedContent,
		clearTerminal,
	} = useFileViewerStore();

	// 从 hook 获取业务逻辑
	const { fileTypes, saveFile, copyPath, getLanguage, stopExecution } =
		useFileViewer();

	const terminalRef = useRef<HTMLDivElement>(null);

	// 自动滚动终端
	useEffect(() => {
		if (terminalRef.current) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
	}, [terminalOutput]);

	// 语法高亮
	useEffect(() => {
		if (mode === "view" && content && !fileTypes.isImage && !fileTypes.isHtml) {
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
	}, [content, mode, fileTypes.isImage, fileTypes.isHtml]);

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
	});

	const language = getLanguage();

	return (
		<div className={styles.modal}>
			<div className={styles.content}>
				{/* 头部 */}
				<div className={styles.header}>
					<div className={styles.title}>
						<span>{fileName}</span>
						<span className={styles.type}>{mode.toUpperCase()}</span>
						<button
							className={styles.btnCopyPath}
							onClick={copyPath}
							title="Copy absolute path"
						>
							<CopyIcon />
						</button>
					</div>
					<div className={styles.actions}>
						{mode === "view" && fileTypes.isExecutable && (
							<button
								className={styles.btnExecute}
								onClick={() => setMode("execute")}
							>
								▶ Execute
							</button>
						)}
						{mode === "view" && fileTypes.isEditable && (
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
						) : fileTypes.isImage ? (
						<img
							src={fileTypes.getRawFileUrl(filePath)}
							alt={fileName}
							className={styles.image}
						/>
						) : fileTypes.isHtml ? (
						<iframe
							src={fileTypes.getRawFileUrl(filePath)}
							title={fileName}
							className={styles.iframe}
							sandbox="allow-scripts allow-same-origin allow-forms"
						/>
						) : (
						<pre className={`${styles.code} language-${language}`}>
							<code data-prism-code className={`language-${language}`}>
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
							onClick={saveFile}
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
							onClick={stopExecution}
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

// Icon 组件
function CopyIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
		);
}
