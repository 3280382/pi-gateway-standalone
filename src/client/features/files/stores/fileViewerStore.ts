/**
 * File Viewer Store - 文件查看器状态
 */

import { create } from "zustand";

export type ViewerMode = "view" | "edit" | "execute";

export interface FileViewerState {
	isOpen: boolean;
	filePath: string;
	fileName: string;
	mode: ViewerMode;
	content: string;
	isLoading: boolean;
	error: string | null;

	// 编辑器状态
	editedContent: string;
	isSaving: boolean;

	// 终端状态
	terminalOutput: string;
	isExecuting: boolean;
}

interface FileViewerActions {
	openViewer: (path: string, name: string, mode: ViewerMode) => void;
	closeViewer: () => void;
	setContent: (content: string) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	setMode: (mode: ViewerMode) => void;

	// 编辑器
	setEditedContent: (content: string) => void;
	setSaving: (saving: boolean) => void;

	// 终端
	appendTerminalOutput: (output: string) => void;
	clearTerminal: () => void;
	setExecuting: (executing: boolean) => void;
}

export const useFileViewerStore = create<FileViewerState & FileViewerActions>()(
	(set) => ({
		// 初始状态
		isOpen: false,
		filePath: "",
		fileName: "",
		mode: "view",
		content: "",
		isLoading: false,
		error: null,
		editedContent: "",
		isSaving: false,
		terminalOutput: "",
		isExecuting: false,

		// 基础操作
		openViewer: (path, name, mode) => {
			console.log("[FileViewerStore] openViewer called:", { path, name, mode });
			set({
				isOpen: true,
				filePath: path,
				fileName: name,
				mode,
				content: "",
				isLoading: true,
				error: null,
				editedContent: "",
				terminalOutput: "",
			});
			console.log("[FileViewerStore] state updated to isOpen=true");
		},

		closeViewer: () => {
			console.log("[FileViewerStore] closeViewer called");
			set({
				isOpen: false,
				filePath: "",
				fileName: "",
				mode: "view",
				content: "",
				isLoading: false,
				error: null,
				editedContent: "",
				isSaving: false,
				terminalOutput: "",
				isExecuting: false,
			});
		},

		setContent: (content) =>
			set({ content, editedContent: content, isLoading: false }),
		setLoading: (loading) => set({ isLoading: loading }),
		setError: (error) => set({ error, isLoading: false }),
		setMode: (mode) => set({ mode }),

		// 编辑器
		setEditedContent: (content) => set({ editedContent: content }),
		setSaving: (saving) => set({ isSaving: saving }),

		// 终端
		appendTerminalOutput: (output) =>
			set((state) => ({
				terminalOutput: state.terminalOutput + output,
			})),
		clearTerminal: () => set({ terminalOutput: "" }),
		setExecuting: (executing) => set({ isExecuting: executing }),
	}),
);
