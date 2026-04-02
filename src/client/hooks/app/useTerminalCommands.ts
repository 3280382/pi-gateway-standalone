/**
 * useTerminalCommands - 终端命令处理 Hook
 * 处理 bash 命令和 slash 命令的执行
 */

import { useCallback, useEffect, useState } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { websocketService } from "@/shared/services/websocket.service";

export interface CommandResult {
	command: string;
	output: string;
	isError: boolean;
	timestamp: Date;
}

export interface UseTerminalCommandsReturn {
	// 状态
	terminalOutput: string;
	terminalCommand: string;
	commandResults: CommandResult[];
	isExecuting: boolean;

	// 操作
	setTerminalOutput: (output: string) => void;
	setTerminalCommand: (command: string) => void;
	executeBashCommand: (command: string) => void;
	executeSlashCommand: (command: string, args: string) => void;
	clearCommands: () => void;
}

export function useTerminalCommands(): UseTerminalCommandsReturn {
	const [terminalOutput, setTerminalOutput] = useState<string>("");
	const [terminalCommand, setTerminalCommand] = useState<string>("");
	const [commandResults, setCommandResults] = useState<CommandResult[]>([]);
	const [isExecuting, setIsExecuting] = useState(false);

	// 监听命令执行结果
	useEffect(() => {
		const unsubscribe = websocketService.on("command_result", (data) => {
			console.log("[TerminalCommands] Command result:", data);

			const result: CommandResult = {
				command: data.command,
				output: data.output,
				isError: data.isError,
				timestamp: new Date(),
			};

			setCommandResults((prev) => [...prev, result]);
			setTerminalOutput(data.output);
			setIsExecuting(false);
		});

		return () => unsubscribe();
	}, []);

	const executeBashCommand = useCallback((command: string) => {
		console.log("[TerminalCommands] Executing bash command:", command);
		setIsExecuting(true);
		setTerminalOutput(`$ ${command}\n`);
		websocketService.executeCommand(command);
	}, []);

	const executeSlashCommand = useCallback((command: string, args: string) => {
		console.log("[TerminalCommands] Executing slash command:", command, args);

		switch (command) {
			case "clear":
				useChatStore.getState().clearMessages();
				setCommandResults([]);
				setTerminalOutput("");
				break;
			case "bash":
				if (args) {
					setIsExecuting(true);
					setTerminalOutput(`$ ${args}\n`);
					websocketService.executeCommand(args);
				}
				break;
			default:
				// 未知命令，作为普通消息发送
				websocketService.send("prompt", { text: `/${command} ${args}` });
				break;
		}
	}, []);

	const clearCommands = useCallback(() => {
		setCommandResults([]);
		setTerminalOutput("");
		setTerminalCommand("");
	}, []);

	return {
		terminalOutput,
		terminalCommand,
		commandResults,
		isExecuting,
		setTerminalOutput,
		setTerminalCommand,
		executeBashCommand,
		executeSlashCommand,
		clearCommands,
	};
}
