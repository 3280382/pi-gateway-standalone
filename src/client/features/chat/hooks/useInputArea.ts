/**
 * useInputArea - InputArea 组件业务逻辑 Hook
 *
 * 职责：
 * - 整合 useFilePicker, useImageUpload, useSlashCommands
 * - 处理键盘事件（发送、命令选择、文件选择）
 * - 处理输入文本变化
 * - 协调发送流程（普通消息、bash 命令、slash 命令、图片）
 */

import { useCallback, useMemo, useRef } from "react";
import { useFilePicker } from "./useFilePicker";
import { useImageUpload } from "./useImageUpload";
import { useSlashCommands } from "./useSlashCommands";

export interface UseInputAreaOptions {
	value: string;
	isStreaming: boolean;
	onChange: (text: string) => void;
	onSend: () => void;
	onAbort: () => void;
	onBashCommand?: (command: string) => void;
	onSlashCommand?: (command: string, args: string) => void;
	onSendWithImages?: (
		text: string,
		images: Array<{
			type: "image";
			source: { type: "base64"; mediaType: string; data: string };
		}>,
	) => void;
}

export interface UseInputAreaReturn {
	// 输入状态
	value: string;
	isStreaming: boolean;
	isBashMode: boolean;
	placeholder: string;

	// File picker 状态
	filePicker: {
		isOpen: boolean;
		isLoading: boolean;
		filteredFiles: ReturnType<typeof useFilePicker>["filteredFiles"];
		selectedIndex: number;
		open: () => Promise<void>;
		close: () => void;
		setSelectedIndex: (index: number | ((prev: number) => number)) => void;
		moveSelection: (direction: "up" | "down") => void;
		selectCurrent: () => void;
	};

	// Slash commands 状态
	slashCommands: {
		isOpen: boolean;
		filteredCommands: ReturnType<typeof useSlashCommands>["filteredCommands"];
		selectedIndex: number;
		open: () => void;
		close: () => void;
		setSelectedIndex: (index: number | ((prev: number) => number)) => void;
		moveSelection: (direction: "up" | "down") => void;
		selectCurrent: () => void;
	};

	// Image upload 状态
	imageUpload: {
		images: ReturnType<typeof useImageUpload>["images"];
		showPreview: boolean;
		addImages: (files: FileList | null) => void;
		removeImage: (id: string) => void;
		togglePreview: () => void;
		hasImages: boolean;
	};

	// 操作
	handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	handleKeyDown: (e: React.KeyboardEvent) => void;
	handleSend: () => void;
	insertTextAtCursor: (
		text: string,
		triggerAction?: "file" | "command" | "bash",
	) => void;
	focusInput: () => void;
}

export function useInputArea(options: UseInputAreaOptions): UseInputAreaReturn {
	const {
		value,
		isStreaming,
		onChange,
		onSend,
		onAbort,
		onBashCommand,
		onSlashCommand,
		onSendWithImages,
	} = options;

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// 子 hooks
	const textareaFocus = useCallback(() => {
		textareaRef.current?.focus();
	}, []);

	const filePicker = useFilePicker({
		value,
		onChange,
		onFocusInput: textareaFocus,
	});

	const slashCommands = useSlashCommands({
		value,
		onChange,
		onFocusInput: textareaFocus,
	});

	const imageUpload = useImageUpload();

	// 是否是 bash 模式
	const isBashMode = useMemo(() => {
		return value.trimStart().startsWith("!");
	}, [value]);

	// placeholder 文本
	const placeholder = useMemo(() => {
		if (isStreaming) return "Generating...";
		if (isBashMode) return "Enter bash command (Ctrl+Enter to execute)...";
		return "Message... Ctrl+Enter to send";
	}, [isStreaming, isBashMode]);

	// 处理输入变化
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onChange(e.target.value);
		},
		[onChange],
	);

	// 处理发送
	const handleSend = useCallback(() => {
		if (isStreaming) {
			onAbort();
			return;
		}

		const trimmedValue = value.trim();
		if (!trimmedValue && imageUpload.images.length === 0) return;

		// Bash 模式
		if (isBashMode) {
			const command = trimmedValue.slice(1);
			if (onBashCommand && command) {
				onBashCommand(command);
			}
			onChange("");
			return;
		}

		// Slash 命令
		if (trimmedValue.startsWith("/")) {
			const parts = trimmedValue.slice(1).split(" ");
			const cmd = parts[0];
			const args = parts.slice(1).join(" ");

			if (onSlashCommand) {
				onSlashCommand(cmd, args);
			}
			onChange("");
			return;
		}

		// 带图片的消息
		if (imageUpload.images.length > 0 && onSendWithImages) {
			onSendWithImages(trimmedValue, imageUpload.getImagesForUpload());
			onChange("");
			imageUpload.clearImages();
			return;
		}

		// 普通消息
		onSend();
	}, [
		value,
		isStreaming,
		isBashMode,
		imageUpload,
		onSend,
		onAbort,
		onBashCommand,
		onSlashCommand,
		onSendWithImages,
		onChange,
	]);

	// 处理键盘事件
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// 文件选择器打开时的键盘处理
			if (filePicker.isOpen && filePicker.filteredFiles.length > 0) {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					filePicker.moveSelection("down");
					return;
				}
				if (e.key === "ArrowUp") {
					e.preventDefault();
					filePicker.moveSelection("up");
					return;
				}
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					filePicker.selectCurrent();
					return;
				}
				if (e.key === "Escape") {
					filePicker.close();
					return;
				}
			}

			// Slash 命令选择器打开时的键盘处理
			if (slashCommands.isOpen && slashCommands.filteredCommands.length > 0) {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					slashCommands.moveSelection("down");
					return;
				}
				if (e.key === "ArrowUp") {
					e.preventDefault();
					slashCommands.moveSelection("up");
					return;
				}
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					slashCommands.selectCurrent();
					return;
				}
				if (e.key === "Escape") {
					slashCommands.close();
					return;
				}
			}

			// Ctrl/Cmd + Enter 发送
			if (
				e.key === "Enter" &&
				(e.ctrlKey || e.metaKey) &&
				!slashCommands.isOpen &&
				!filePicker.isOpen
			) {
				e.preventDefault();
				handleSend();
				return;
			}
		},
		[filePicker, slashCommands, handleSend],
	);

	// 在光标位置插入文本
	const insertTextAtCursor = useCallback(
		(text: string, triggerAction?: "file" | "command" | "bash") => {
			const textarea = textareaRef.current;
			if (!textarea) {
				onChange(value + text);
				return;
			}

			textarea.focus();
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const newValue = value.substring(0, start) + text + value.substring(end);
			onChange(newValue);

			// 设置光标位置
			const newCursorPos = start + text.length;
			textarea.setSelectionRange(newCursorPos, newCursorPos);

			// 触发相应操作
			if (triggerAction === "file") {
				filePicker.open(false);
			} else if (triggerAction === "command") {
				slashCommands.open();
			}
		},
		[value, onChange, filePicker, slashCommands],
	);

	// 聚焦输入框
	const focusInput = useCallback(() => {
		textareaRef.current?.focus();
	}, []);

	return {
		// 输入状态
		value,
		isStreaming,
		isBashMode,
		placeholder,

		// File picker
		filePicker: {
			isOpen: filePicker.isOpen,
			isLoading: filePicker.isLoading,
			filteredFiles: filePicker.filteredFiles,
			selectedIndex: filePicker.selectedIndex,
			open: filePicker.open,
			close: filePicker.close,
			setSelectedIndex: filePicker.setSelectedIndex,
			moveSelection: filePicker.moveSelection,
			selectCurrent: () => {
				const file = filePicker.filteredFiles[filePicker.selectedIndex];
				if (file) filePicker.selectFile(file);
			},
		},

		// Slash commands
		slashCommands: {
			isOpen: slashCommands.isOpen,
			filteredCommands: slashCommands.filteredCommands,
			selectedIndex: slashCommands.selectedIndex,
			open: slashCommands.open,
			close: slashCommands.close,
			setSelectedIndex: slashCommands.setSelectedIndex,
			moveSelection: slashCommands.moveSelection,
			selectCurrent: () => {
				const cmd = slashCommands.filteredCommands[slashCommands.selectedIndex];
				if (cmd) slashCommands.selectCommand(cmd);
			},
		},

		// Image upload
		imageUpload: {
			images: imageUpload.images,
			showPreview: imageUpload.showPreview,
			addImages: imageUpload.addImages,
			removeImage: imageUpload.removeImage,
			togglePreview: imageUpload.togglePreview,
			hasImages: imageUpload.images.length > 0,
		},

		// 操作
		handleChange,
		handleKeyDown,
		handleSend,
		insertTextAtCursor,
		focusInput,
		// 暴露 ref 供外部使用
		textareaRef: textareaRef as React.RefObject<HTMLTextAreaElement>,
	};
}
