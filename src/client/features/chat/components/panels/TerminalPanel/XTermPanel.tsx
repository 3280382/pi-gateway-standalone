/**
 * XTermPanel - Real xterm.js terminal for file operations
 */

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { useSessionStore } from "@/shared/stores/sessionStore";
import styles from "./XTermPanel.module.css";

interface XTermPanelProps {
	height: number;
	onClose: () => void;
	onHeightChange: (height: number) => void;
	output?: string;
	onExecuteCommand?: (command: string) => void;
	initialCommand?: string;
}

export function XTermPanel({
	height,
	onClose,
	onHeightChange,
	output,
	onExecuteCommand,
	initialCommand,
}: XTermPanelProps) {
	const terminalRef = useRef<HTMLDivElement>(null);
	const terminalInstance = useRef<Terminal | null>(null);
	const fitAddon = useRef<FitAddon | null>(null);
	const isResizing = useRef(false);
	const resizeStartY = useRef(0);
	const resizeStartHeight = useRef(height);
	const commandBuffer = useRef("");
	const abortControllerRef = useRef<AbortController | null>(null);
	const currentDir = useSessionStore((state) => state.currentDir);

	// Initialize terminal
	useEffect(() => {
		if (!terminalRef.current || terminalInstance.current) return;

		const term = new Terminal({
			cursorBlink: true,
			fontSize: 11,
			fontFamily: 'JetBrains Mono, "Fira Code", monospace',
			lineHeight: 1.2,
			theme: {
				background: "#0d1117",
				foreground: "#e6edf3",
				cursor: "#e6edf3",
				selectionBackground: "#264f78",
				black: "#484f58",
				red: "#ff7b72",
				green: "#7ee787",
				yellow: "#e3b341",
				blue: "#79c0ff",
				magenta: "#d2a8ff",
				cyan: "#56d4dd",
				white: "#e6edf3",
			},
			scrollback: 10000,
		});

		const fit = new FitAddon();
		term.loadAddon(fit);

		term.open(terminalRef.current);
		fit.fit();

		// Execute command on server
		const executeCommand = async (command: string) => {
			try {
				// Cancel any pending request
				if (abortControllerRef.current) {
					abortControllerRef.current.abort();
				}
				abortControllerRef.current = new AbortController();

				const response = await fetch("/api/execute", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						command,
						cwd: currentDir,
						streaming: true,
					}),
					signal: abortControllerRef.current.signal,
				});

				if (!response.ok) {
					const error = await response.text();
					term.writeln(`\x1b[31mError: ${error}\x1b[0m`);
					return;
				}

				// Read stream
				const reader = response.body?.getReader();
				if (!reader) {
					term.writeln("\x1b[31mError: No response body\x1b[0m");
					return;
				}

				const decoder = new TextDecoder();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					const text = decoder.decode(value, { stream: true });
					// Write raw output (preserve ANSI colors from server)
					term.write(text);
				}
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					term.writeln("\x1b[33m[Cancelled]\x1b[0m");
				} else {
					term.writeln(`\x1b[31mError: ${error}\x1b[0m`);
				}
			}
		};

		// Handle input
		term.onData((data) => {
			const code = data.charCodeAt(0);

			// Enter key
			if (code === 13) {
				term.writeln("");
				if (commandBuffer.current.trim()) {
					const cmd = commandBuffer.current;
					if (onExecuteCommand) {
						onExecuteCommand(cmd);
					}
					// Execute on server
					executeCommand(cmd).then(() => {
						prompt(term);
					});
				} else {
					prompt(term);
				}
				commandBuffer.current = "";
			}
			// Backspace
			else if (code === 127) {
				if (commandBuffer.current.length > 0) {
					commandBuffer.current = commandBuffer.current.slice(0, -1);
					term.write("\b \b");
				}
			}
			// Ctrl+C
			else if (code === 3) {
				term.writeln("^C");
				commandBuffer.current = "";
				prompt(term);
			}
			// Ctrl+L
			else if (code === 12) {
				term.clear();
				prompt(term);
			}
			// Regular character
			else if (code >= 32 && code < 127) {
				commandBuffer.current += data;
				term.write(data);
			}
		});

		terminalInstance.current = term;
		fitAddon.current = fit;

		// Initial prompt
		prompt(term);

		// Execute initial command if provided
		if (initialCommand) {
			term.writeln(`$ ${initialCommand}`);
			if (onExecuteCommand) {
				onExecuteCommand(initialCommand);
			}
			// Execute on server
			executeCommand(initialCommand).then(() => {
				prompt(term);
			});
		}

		// Handle resize
		const handleResize = () => {
			fit.fit();
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
			term.dispose();
			terminalInstance.current = null;
		};
	}, [onExecuteCommand, initialCommand, currentDir]);

	// Handle output updates
	useEffect(() => {
		if (!terminalInstance.current || !output) return;

		const lines = output.split("\n");
		for (const line of lines) {
			if (line.trim()) {
				terminalInstance.current.writeln(line);
			}
		}
		prompt(terminalInstance.current);
	}, [output]);

	// Update height
	useEffect(() => {
		if (terminalInstance.current && fitAddon.current) {
			setTimeout(() => {
				fitAddon.current?.fit();
			}, 0);
		}
	}, [height]);

	const prompt = (term: Terminal) => {
		term.write("\x1b[36m$\x1b[0m ");
	};

	// Resize handlers
	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			isResizing.current = true;
			resizeStartY.current = e.clientY;
			resizeStartHeight.current = height;
			e.preventDefault();
		},
		[height],
	);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!isResizing.current) return;
			const delta = resizeStartY.current - e.clientY;
			const newHeight = Math.max(
				100,
				Math.min(600, resizeStartHeight.current + delta),
			);
			onHeightChange(newHeight);
		};

		const handleMouseUp = () => {
			isResizing.current = false;
		};

		if (isResizing.current) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "ns-resize";
			document.body.style.userSelect = "none";
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
	}, [onHeightChange]);

	const handleClear = () => {
		terminalInstance.current?.clear();
		prompt(terminalInstance.current!);
	};

	return (
		<div className={styles.panel} style={{ height: `${height}px` }}>
			{/* Resize handle */}
			<div
				className={styles.resizeHandle}
				onMouseDown={handleResizeStart}
				title="Drag to resize"
			>
				<div className={styles.resizeGrip} />
			</div>

			{/* Header */}
			<div className={styles.header}>
				<div className={styles.title}>
					<TerminalIcon />
					<span>Terminal</span>
				</div>
				<div className={styles.actions}>
					<button
						className={styles.actionBtn}
						onClick={handleClear}
						title="Clear"
					>
						<ClearIcon />
					</button>
					<button className={styles.actionBtn} onClick={onClose} title="Close">
						<CloseIcon />
					</button>
				</div>
			</div>

			{/* Terminal container */}
			<div ref={terminalRef} className={styles.terminal} />
		</div>
	);
}

// Icons
function TerminalIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			width="16"
			height="16"
		>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	);
}

function ClearIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			width="14"
			height="14"
		>
			<path d="M3 6h18" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			width="14"
			height="14"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
