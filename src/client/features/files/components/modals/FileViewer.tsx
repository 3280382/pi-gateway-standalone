/**
 * FileViewer - 文件查看器模态框
 *
 * 职责：纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useFileViewer hook 获取所有逻辑
 */

import { defaultKeymap } from "@codemirror/commands";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import React, { useCallback, useEffect, useRef } from "react";
import { useFileViewer } from "@/features/files/hooks";
import { useFileViewerStore } from "@/features/files/stores/viewerStore";
import { fileViewerDebug } from "@/lib/debug";
import styles from "./FileViewer.module.css";
import { getLanguageExtension } from "./languageExtensions";

export function FileViewer() {
	// ========== 1. State ==========
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
		showInvisibleChars,
		terminalOutput,
		isExecuting,
		closeViewer,
		setMode,
		setEditedContent,
		toggleShowInvisibleChars,
		clearTerminal,
	} = useFileViewerStore();

	// 从 hook 获取业务逻辑
	const { fileTypes, saveFile, copyPath, getLanguage, stopExecution } =
		useFileViewer();

	// ========== 2. Ref ==========
	const terminalRef = useRef<HTMLDivElement>(null);
	// CodeMirror 编辑器相关 refs
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorViewRef = useRef<EditorView | null>(null);
	const languageCompartmentRef = useRef<Compartment | null>(null);
	const isUpdatingRef = useRef(false); // 防止循环更新

	// ========== 3. Effects ==========
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

	// 初始化 CodeMirror 编辑器
	useEffect(() => {
		// 仅在编辑模式且容器存在时初始化
		if (mode !== "edit" || !editorContainerRef.current) {
			return;
		}

		// 如果编辑器已存在，销毁重建（语言可能变化）
		if (editorViewRef.current) {
			editorViewRef.current.destroy();
			editorViewRef.current = null;
		}

		// 创建语言 compartment（用于动态切换语言）
		const languageCompartment = new Compartment();
		languageCompartmentRef.current = languageCompartment;

		// 获取语言扩展
		const languageExtension = getLanguageExtension(getLanguage());

		// 创建编辑器状态
		const startState = EditorState.create({
			doc: editedContent || "",
			extensions: [
				basicSetup,
				oneDark,
				// 自定义主题覆盖
				EditorView.theme({
					"&": {
						fontSize: "10px",
						fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
						height: "100%",
					},
					".cm-content": {
						padding: "8px",
					},
					".cm-gutters": {
						backgroundColor: "var(--bg-tertiary)",
						borderRight: "1px solid var(--border-color)",
					},
					".cm-activeLineGutter": {
						backgroundColor: "var(--bg-hover)",
					},
				}),
				// 语言支持
				languageCompartment.of(languageExtension),
				// 按键绑定
				keymap.of([
					...defaultKeymap,
					{
						key: "Ctrl-s",
						preventDefault: true,
						run: () => {
							saveFile();
							return true;
						},
					},
				]),
				// 监听变化，双向绑定到 store
				EditorView.updateListener.of((update) => {
					if (update.docChanged && !isUpdatingRef.current) {
						const newContent = update.state.doc.toString();
						setEditedContent(newContent);
					}
				}),
			],
		});

		// 创建编辑器视图
		const view = new EditorView({
			state: startState,
			parent: editorContainerRef.current,
		});

		editorViewRef.current = view;

		// 清理函数
		return () => {
			view.destroy();
			editorViewRef.current = null;
		};
	}, [mode, fileName]); // 模式或文件名变化时重建编辑器

	// 同步 store 内容到编辑器（外部修改时）
	useEffect(() => {
		const view = editorViewRef.current;
		if (!view || mode !== "edit") return;

		const currentDoc = view.state.doc.toString();
		if (currentDoc !== editedContent) {
			// 标记正在更新，防止触发 updateListener 的循环
			isUpdatingRef.current = true;
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: editedContent || "",
				},
			});
			isUpdatingRef.current = false;
		}
	}, [editedContent, mode]);

	// 动态切换语言
	useEffect(() => {
		if (
			mode !== "edit" ||
			!editorViewRef.current ||
			!languageCompartmentRef.current
		)
			return;

		const lang = getLanguage();
		const newExtension = getLanguageExtension(lang);

		editorViewRef.current.dispatch({
			effects: languageCompartmentRef.current.reconfigure(newExtension),
		});
	}, [filePath, mode]); // 文件路径变化时重新配置语言

	// 进入编辑模式后自动聚焦
	useEffect(() => {
		if (mode === "edit") {
			const timer = setTimeout(focusEditor, 100);
			return () => clearTimeout(timer);
		}
	}, [mode]);

	// ========== 4. Computed ==========
	// Prism.js 查看模式语言映射（tsx -> typescript）
	const language = getLanguage();
	const prismLanguage =
		language === "tsx"
			? "typescript"
			: language === "jsx"
				? "javascript"
				: language;

	// 渲染带有非可视化符号的内容
	const renderContentWithInvisibleChars = (text: string): string => {
		if (!showInvisibleChars) return text;
		
		// 替换非可视化字符
		return text
			.replace(/\t/g, '→   ')  // 制表符
			.replace(/ /g, '·')      // 空格
			.replace(/\n/g, '¶\n')  // 换行符（在行尾添加）
			.replace(/\r/g, '↵');    // 回车符
	};

	// ========== 5. Actions ==========
	// 修复编辑器焦点问题
	const focusEditor = useCallback(() => {
		if (editorViewRef.current && mode === "edit") {
			editorViewRef.current.focus();
		}
	}, [mode]);

	// ========== 6. Render ==========
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

	return (
		<div className={styles.modal}>
			<div className={styles.content}>
				{/* 头部 */}
				<div className={styles.header}>
					<div className={styles.title}>
						<span>{fileName}</span>
						<span className={styles.type}>{mode.toUpperCase()}</span>
						{mode === "edit" && language && (
							<span className={styles.lang}>{language}</span>
						)}
						<button
							className={styles.btnCopyPath}
							onClick={copyPath}
							title="Copy absolute path"
						>
							<CopyIcon />
						</button>
					</div>
					<div className={styles.actions}>
						{mode === "view" && (
							<button
								className={`${styles.btnToggle} ${showInvisibleChars ? styles.active : ""}`}
								onClick={toggleShowInvisibleChars}
								title="Show invisible characters (spaces, tabs, line breaks)"
							>
								{showInvisibleChars ? "Hide" : "Show"} Invisible
							</button>
						)}
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
						<div
							ref={editorContainerRef}
							className={styles.editorContainer}
							onClick={focusEditor}
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
						<pre className={`${styles.code} language-${prismLanguage}`}>
							<code data-prism-code className={`language-${prismLanguage}`}>
								{showInvisibleChars
									? renderContentWithInvisibleChars(
											typeof content === "string"
												? content
												: JSON.stringify(content, null, 2)
										)
									: typeof content === "string"
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
							{isSaving ? "Saving..." : "Save (Ctrl+S)"}
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