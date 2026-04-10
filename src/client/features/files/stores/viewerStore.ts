/**
 * Viewer Store - 文件查看器和终端状态管理
 *
 * 职责：
 * - 管理文件查看器状态（查看、编辑、执行模式）
 * - 管理终端状态（输出、命令执行）
 * - 合并原 fileViewerStore 和 terminalStore
 *
 * 结构规范：State → Actions
 */

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export type ViewerMode = "view" | "edit" | "execute";

export interface ViewerState {
	// 文件查看器状态
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

	// 终端状态（原 terminalStore）
	terminalOutput: string;
	terminalCommand: string;
	isExecuting: boolean;
}

interface ViewerActions {
	// 文件查看器操作
	openViewer: (path: string, name: string, mode: ViewerMode) => void;
	openViewerWithContent: (name: string, content: string, mode?: ViewerMode) => void;
	closeViewer: () => void;
	setContent: (content: string) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	setMode: (mode: ViewerMode) => void;

	// 编辑器操作
	setEditedContent: (content: string) => void;
	setSaving: (saving: boolean) => void;

	// 终端操作（原 terminalStore + fileViewerStore）
	setTerminalOutput: (output: string) => void;
	appendTerminalOutput: (output: string) => void;
	setTerminalCommand: (command: string) => void;
	setExecuting: (isExecuting: boolean) => void;
	clearTerminal: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useViewerStore = create<ViewerState & ViewerActions>()((set) => ({
	// ========== 1. State ==========
	// 文件查看器初始状态
	isOpen: false,
	filePath: "",
	fileName: "",
	mode: "view",
	content: "",
	isLoading: false,
	error: null,

	// 编辑器初始状态
	editedContent: "",
	isSaving: false,

	// 终端初始状态
	terminalOutput: "",
	terminalCommand: "",
	isExecuting: false,

	// ========== 2. Actions ==========
	// 文件查看器
	openViewer: (path, name, mode) => {
		console.log("[ViewerStore] openViewer:", { path, name, mode });
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
	},

	openViewerWithContent: (name, content, mode = "view") => {
		console.log("[ViewerStore] openViewerWithContent:", { name, contentLength: content?.length, mode });
		set({
			isOpen: true,
			filePath: "",
			fileName: name,
			mode,
			content,
			isLoading: false,
			error: null,
			editedContent: content,
			terminalOutput: "",
		});
	},

	closeViewer: () => {
		console.log("[ViewerStore] closeViewer");
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
			terminalCommand: "",
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

	// 终端（合并自 terminalStore）
	setTerminalOutput: (output) => set({ terminalOutput: output }),
	appendTerminalOutput: (output) =>
		set((state) => ({ terminalOutput: state.terminalOutput + output })),
	setTerminalCommand: (command) => set({ terminalCommand: command }),
	setExecuting: (isExecuting) => set({ isExecuting }),
	clearTerminal: () => set({ terminalOutput: "", terminalCommand: "" }),
}));

// ============================================================================
// Backward Compatibility Exports
// ============================================================================

/** @deprecated 使用 useViewerStore */
export const useFileViewerStore = useViewerStore;

/** @deprecated 使用 useViewerStore */
export const useTerminalStore = useViewerStore;
