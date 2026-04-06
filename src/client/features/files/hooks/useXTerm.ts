/**
 * useXTerm - XTerm 终端业务逻辑 Hook
 *
 * 职责：管理 xterm.js 终端的所有业务逻辑
 * - 终端初始化
 * - 命令执行（API 调用）
 * - 输入处理
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

interface UseXTermOptions {
	currentDir: string;
	onExecuteCommand?: (command: string) => void;
	initialCommand?: string;
}

interface UseXTermResult {
	terminalRef: React.RefObject<HTMLDivElement>;
	isFullscreen: boolean;
	toggleFullscreen: () => void;
	executeCommand: (command: string) => Promise<void>;
}

export function useXTerm({
	currentDir,
	onExecuteCommand,
	initialCommand,
}: UseXTermOptions): UseXTermResult {
	const terminalRef = useRef<HTMLDivElement>(null);
	const terminalInstance = useRef<Terminal | null>(null);
	const fitAddon = useRef<FitAddon | null>(null);
	const commandBuffer = useRef("");
	const abortControllerRef = useRef<AbortController | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);

	const toggleFullscreen = useCallback(() => {
		setIsFullscreen((prev) => !prev);
	}, []);

	// 执行命令（API 调用）
	const executeCommand = useCallback(
		async (command: string, term?: Terminal) => {
			const targetTerm = term || terminalInstance.current;
			if (!targetTerm) return;

			try {
				if (abortControllerRef.current) {
					abortControllerRef.current.abort();
				}
				abortControllerRef.current = new AbortController();

				const response = await fetch("/api/execute", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						command,
						cwd: currentDir,
						streaming: true,
					}),
					signal: abortControllerRef.current.signal,
				});

				if (!response.ok) {
					const error = await response.text();
					targetTerm.writeln(`\x1b[31mError: ${error}\x1b[0m`);
					return;
				}

				const reader = response.body?.getReader();
				if (!reader) {
					targetTerm.writeln("\x1b[31mError: No response body\x1b[0m");
					return;
				}

				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						targetTerm.writeln(line);
					}
				}

				if (buffer) {
					targetTerm.write(buffer);
				}
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					targetTerm.writeln("\x1b[33m[Cancelled]\x1b[0m");
				} else {
					targetTerm.writeln(`\x1b[31mError: ${error}\x1b[0m`);
				}
			}
		},
		[currentDir],
	);

	// 显示提示符
	const prompt = useCallback((term: Terminal) => {
		term.write("\x1b[36m$\x1b[0m ");
	}, []);

	// 初始化终端
	useEffect(() => {
		const container = terminalRef.current;
		if (!container || terminalInstance.current) return;

		// 确保容器有尺寸
		if (container.clientHeight === 0 || container.clientWidth === 0) {
			console.warn("[XTermPanel] Container has no size, delaying init");
			const checkSize = setInterval(() => {
				if (container.clientHeight > 0 && container.clientWidth > 0) {
					clearInterval(checkSize);
					window.dispatchEvent(new Event("resize"));
				}
			}, 50);
			setTimeout(() => clearInterval(checkSize), 2000);
			return;
		}

		// 动态导入 xterm（避免 SSR 问题）
		const initTerminal = async () => {
			const { Terminal } = await import("@xterm/xterm");
			const { FitAddon } = await import("@xterm/addon-fit");

			const term = new Terminal({
				cursorBlink: true,
				fontSize: 13,
				fontFamily:
					'"JetBrains Mono", "Fira Code", "Consolas", "Monaco", monospace',
				lineHeight: 1.3,
				theme: {
					background: "#0d1117",
					foreground: "#e6edf3",
					cursor: "#e6edf3",
					selectionBackground: "#264f78",
				},
				scrollback: 10000,
				allowProposedApi: true,
			});

			const fit = new FitAddon();
			term.loadAddon(fit);
			term.open(container);

			requestAnimationFrame(() => {
				fit.fit();
				console.log("[XTermPanel] Terminal initialized:", term.cols, "x", term.rows);
			});

			// 处理输入
			term.onData((data) => {
				const code = data.charCodeAt(0);

				if (code === 13) {
					// Enter
					term.writeln("");
					if (commandBuffer.current.trim()) {
						const cmd = commandBuffer.current;
						if (onExecuteCommand) onExecuteCommand(cmd);
						executeCommand(cmd, term).then(() => prompt(term));
					} else {
						prompt(term);
					}
					commandBuffer.current = "";
				} else if (code === 127) {
					// Backspace
					if (commandBuffer.current.length > 0) {
						commandBuffer.current = commandBuffer.current.slice(0, -1);
						term.write("\b \b");
					}
				} else if (code === 3) {
					// Ctrl+C
					term.writeln("^C");
					commandBuffer.current = "";
					prompt(term);
				} else if (code === 12) {
					// Ctrl+L
					term.clear();
					prompt(term);
				} else if (code >= 32 && code < 127) {
					commandBuffer.current += data;
					term.write(data);
				}
			});

			terminalInstance.current = term;
			fitAddon.current = fit;
			prompt(term);

			// 执行初始命令
			if (initialCommand) {
				term.writeln(`$ ${initialCommand}`);
				if (onExecuteCommand) onExecuteCommand(initialCommand);
				executeCommand(initialCommand, term).then(() => prompt(term));
			}

			// 处理窗口大小变化
			const handleResize = () => fit.fit();
			window.addEventListener("resize", handleResize);

			return () => {
				window.removeEventListener("resize", handleResize);
			};
		};

		const cleanupPromise = initTerminal();

		return () => {
			abortControllerRef.current?.abort();
			cleanupPromise.then((cleanup) => cleanup?.());
			terminalInstance.current?.dispose();
			terminalInstance.current = null;
		};
	}, [currentDir, onExecuteCommand, initialCommand, executeCommand, prompt]);

	return {
		terminalRef,
		isFullscreen,
		toggleFullscreen,
		executeCommand,
	};
}
