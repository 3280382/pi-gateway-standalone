import React from "react";
/**
 * FileActionBar - 选中文件操作栏
 */
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { fileActionBarDebug } from "@/lib/debug";
import { executeFile } from "@/features/files/services/api/fileApi";
import styles from "./FileBrowser.module.css";

interface FileActionBarProps {
	onExecute?: (output: string) => void;
	onOpenBottomPanel?: (output: string) => void;
}
export function FileActionBar({
	onExecute,
	onOpenBottomPanel,
}: FileActionBarProps) {
	const { selectedActionFile, selectedActionFileName } = useFileStore();
	const { openViewer } = useFileViewerStore();
	if (!selectedActionFile) {
		return null;
	}
	const ext = selectedActionFile.split(".").pop()?.toLowerCase() || "";
	// 可执行文件扩展名列表
	const EXECUTABLE_EXTENSIONS = [
		"sh",
		"bash",
		"zsh",
		"py",
		"js",
		"ts",
		"pl",
		"rb",
		"php",
		"go",
		"java",
		"c",
		"cpp",
		"rs",
	];
	const isExecutable =
		EXECUTABLE_EXTENSIONS.some((ext) =>
			selectedActionFileName?.toLowerCase().endsWith("." + ext),
		) || !selectedActionFileName?.includes("."); // 无扩展名的文件也可能是可执行脚本
	const isEditable = ![
		"png",
		"jpg",
		"jpeg",
		"gif",
		"webp",
		"ico",
		"pdf",
	].includes(ext);
	const handleView = () => {
		fileActionBarDebug.info("点击View按钮", {
			path: selectedActionFile,
			name: selectedActionFileName,
		});
		openViewer(selectedActionFile, selectedActionFileName || "", "view");
		fileActionBarDebug.info("openViewer调用完成");
	};
	const handleEdit = () => {
		fileActionBarDebug.info("点击Edit按钮", {
			path: selectedActionFile,
			name: selectedActionFileName,
		});
		openViewer(selectedActionFile, selectedActionFileName || "", "edit");
		fileActionBarDebug.info("openViewer调用完成");
	};
	const handleExecute = async () => {
		if (onExecute) {
			onExecute(`$ Executing: ${selectedActionFileName}`);
		}
		if (onOpenBottomPanel) {
			onOpenBottomPanel(`$ Executing: ${selectedActionFileName}\n`);
		}

		try {
			const stream = await executeFile(selectedActionFile);
			const reader = stream.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const text = decoder.decode(value, { stream: true });
				if (onExecute) {
					onExecute(text);
				}
				if (onOpenBottomPanel) {
					onOpenBottomPanel(text);
				}
			}

			if (onOpenBottomPanel) {
				onOpenBottomPanel(`\n[Execution completed]\n`);
			}
		} catch (error) {
			const errorMsg = `Error: ${error instanceof Error ? error.message : "Execution failed"}`;
			if (onExecute) {
				onExecute(errorMsg);
			}
			if (onOpenBottomPanel) {
				onOpenBottomPanel(`\n${errorMsg}\n`);
			}
		}
	};
	return (
		<div className={styles.actionBar}>
			<span className={styles.selectedName}>{selectedActionFileName}</span>
			<button
				className={`${styles.actionBtn} ${styles.view}`}
				onClick={handleView}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
				View
			</button>
			{isEditable && (
				<button
					className={`${styles.actionBtn} ${styles.edit}`}
					onClick={handleEdit}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
					</svg>
					Edit
				</button>
			)}
			{isExecutable && (
				<button
					className={`${styles.actionBtn} ${styles.execute}`}
					onClick={handleExecute}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
					>
						<polygon points="5 3 19 12 5 21 5 3" />
					</svg>
					Run
				</button>
			)}
		</div>
	);
}
