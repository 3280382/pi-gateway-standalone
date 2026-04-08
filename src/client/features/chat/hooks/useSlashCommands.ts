/**
 * useSlashCommands - Slash Command 处理 Hook
 *
 * 职责：
 * - 管理 slash command 选择器状态
 * - 过滤命令列表
 * - 处理命令选择
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { SLASH_COMMANDS } from "@/features/chat/types/slashCommands";

export interface SlashCommand {
	name: string;
	description: string;
	icon: string;
}

export interface UseSlashCommandsReturn {
	// 状态
	isOpen: boolean;
	filter: string;
	selectedIndex: number;
	filteredCommands: SlashCommand[];

	// 操作
	open: () => void;
	close: () => void;
	setFilter: (filter: string) => void;
	setSelectedIndex: (index: number | ((prev: number) => number)) => void;
	selectCommand: (command: SlashCommand) => void;
	moveSelection: (direction: "up" | "down") => void;
	isSlashCommand: (text: string) => boolean;
	getActiveCommand: (text: string) => SlashCommand | undefined;
}

interface UseSlashCommandsOptions {
	value: string;
	onChange: (newValue: string) => void;
	onFocusInput?: () => void;
}

export function useSlashCommands(
	options: UseSlashCommandsOptions,
): UseSlashCommandsReturn {
	const { value, onChange, onFocusInput } = options;

	// 状态
	const [isOpen, setIsOpen] = useState(false);
	const [filter, setFilter] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);

	// 过滤命令列表
	const filteredCommands = useMemo(() => {
		if (!filter) return SLASH_COMMANDS;
		const lowerFilter = filter.toLowerCase();
		return SLASH_COMMANDS.filter(
			(cmd) =>
				cmd.name.toLowerCase().includes(lowerFilter) ||
				cmd.description.toLowerCase().includes(lowerFilter),
		);
	}, [filter]);

	// 检测 slash command 触发
	useEffect(() => {
		if (value.startsWith("/") && !value.includes(" ")) {
			const newFilter = value.slice(1).toLowerCase();
			setFilter(newFilter);
			setIsOpen(true);
			setSelectedIndex(0);
		} else {
			setIsOpen(false);
		}
	}, [value]);

	// 打开命令选择器
	const open = useCallback(() => {
		const newValue = value + "/";
		onChange(newValue);
		setFilter("");
		setIsOpen(true);
		setSelectedIndex(0);
		onFocusInput?.();
	}, [value, onChange, onFocusInput]);

	// 关闭命令选择器
	const close = useCallback(() => {
		setIsOpen(false);
	}, []);

	// 选择命令
	const selectCommand = useCallback(
		(command: SlashCommand) => {
			const commandText = `${command.name} `;
			onChange(commandText);
			setIsOpen(false);
			onFocusInput?.();
		},
		[onChange, onFocusInput],
	);

	// 移动选择
	const moveSelection = useCallback(
		(direction: "up" | "down") => {
			if (filteredCommands.length === 0) return;
			if (direction === "down") {
				setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
			} else {
				setSelectedIndex((prev) =>
					prev <= 0 ? filteredCommands.length - 1 : prev - 1,
				);
			}
		},
		[filteredCommands.length],
	);

	// 检查是否是 slash command
	const isSlashCommand = useCallback((text: string): boolean => {
		return text.trimStart().startsWith("/");
	}, []);

	// 获取当前激活的命令
	const getActiveCommand = useCallback(
		(text: string): SlashCommand | undefined => {
			const trimmed = text.trimStart();
			if (!trimmed.startsWith("/")) return undefined;
			const parts = trimmed.slice(1).split(" ");
			const cmdName = parts[0];
			return SLASH_COMMANDS.find((cmd) => cmd.name === cmdName);
		},
		[],
	);

	return {
		isOpen,
		filter,
		selectedIndex,
		filteredCommands,
		open,
		close,
		setFilter,
		setSelectedIndex,
		selectCommand,
		moveSelection,
		isSlashCommand,
		getActiveCommand,
	};
}
