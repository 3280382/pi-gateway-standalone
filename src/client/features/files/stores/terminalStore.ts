/**
 * Terminal Store - 文件浏览器终端状态管理
 */

import { create } from "zustand";

interface TerminalState {
	output: string;
	command: string;
	isExecuting: boolean;
}

interface TerminalActions {
	setOutput: (output: string) => void;
	appendOutput: (output: string) => void;
	setCommand: (command: string) => void;
	setExecuting: (isExecuting: boolean) => void;
	clear: () => void;
}

export const useTerminalStore = create<TerminalState & TerminalActions>((set) => ({
	output: "",
	command: "",
	isExecuting: false,
	setOutput: (output) => set({ output }),
	appendOutput: (output) => set((state) => ({ output: state.output + output })),
	setCommand: (command) => set({ command }),
	setExecuting: (isExecuting) => set({ isExecuting }),
	clear: () => set({ output: "", command: "" }),
}));
