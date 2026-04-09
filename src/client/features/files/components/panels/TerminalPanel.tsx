/**
 * TerminalPanel - XTerm.js Terminal Component
 *
 * 职责：
 * - 提供真实的 xterm.js 终端体验
 * - 支持命令执行、全屏模式
 * - 合并了原 useXTerm hook 的所有逻辑
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFileStore } from "@/features/files/stores";
import "@xterm/xterm/css/xterm.css";
import styles from "./TerminalPanel.module.css";

// ============================================================================
// Types
// ============================================================================

interface TerminalPanelProps {
	height: number;
	onClose: () => void;
	onHeightChange: (height: number) => void;
	onExecuteCommand?: (command: string) => void;
	initialCommand?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TerminalPanel({
	height,
	onClose,
	onHeightChange,
	onExecuteCommand,
	initialCommand,
}: TerminalPanelProps) {
	// ========== 1. State ==========
	const currentPath = useFileStore((state) => state.currentPath);
	const [isFullscreen, setIsFullscreen] = useState(false);

	// ========== 2. Refs ==========
	const terminalRef = useRef<HTMLDivElement>(null);
	const terminalInstance = useRef<Terminal | null>(null);
	const fitAddon = useRef<FitAddon | null>(null);
	const commandBuffer = useRef("");
	const abortControllerRef = useRef<AbortController | null>(null);
	const isResizing = useRef(false);
	const resizeStartY = useRef(0);
	const resizeStartHeight = useRef(height);

	// ========== 3. Actions ==========
	const toggleFullscreen = useCallback(() => {
		setIsFullscreen((prev) => !prev);
	}, []);

	const prompt = useCallback((term: Terminal) => {
		term.write("\x1b[36m$\x1b[0m ");
	}, []);

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
						cwd: currentPath,
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
		[currentPath],
	);

	// ========== 4. Effects ==========
	// Initialize terminal
	useEffect(() => {
		const container = terminalRef.current;
		if (!container || terminalInstance.current) return;

		if (container.clientHeight === 0 || container.clientWidth === 0) {
			console.warn("[TerminalPanel] Container has no size, delaying init");
			const checkSize = setInterval(() => {
				if (container.clientHeight > 0 && container.clientWidth > 0) {
					clearInterval(checkSize);
					window.dispatchEvent(new Event("resize"));
				}
			}, 50);
			setTimeout(() => clearInterval(checkSize), 2000);
			return;
		}

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
				console.log(
					"[TerminalPanel] Terminal initialized:",
					term.cols,
					"x",
					term.rows,
				);
			});

			term.onData((data) => {
				const code = data.charCodeAt(0);

				if (code === 13) {
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
					if (commandBuffer.current.length > 0) {
						commandBuffer.current = commandBuffer.current.slice(0, -1);
						term.write("\b \b");
					}
				} else if (code === 3) {
					term.writeln("^C");
					commandBuffer.current = "";
					prompt(term);
				} else if (code === 12) {
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

			if (initialCommand) {
				term.writeln(`$ ${initialCommand}`);
				if (onExecuteCommand) onExecuteCommand(initialCommand);
				executeCommand(initialCommand, term).then(() => prompt(term));
			}

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
	}, [currentPath, onExecuteCommand, initialCommand, executeCommand, prompt]);

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

	// ========== 5. Render ==========
	return (
		<div
			className={`${styles.panel} ${isFullscreen ? styles.fullscreen : ""}`}
			style={{ height: isFullscreen ? "100vh" : `${height}px` }}
		>
			{/* Resize handle */}
			{!isFullscreen && (
				<div
					className={styles.resizeHandle}
					onMouseDown={handleResizeStart}
				>
					<div className={styles.resizeGrip} />
				</div>
			)}

			{/* Header */}
			<div className={styles.header}>
				<div className={styles.title}>
					<TerminalIcon />
					<span>Terminal</span>
				</div>
				<div className={styles.actions}>
					<button
						className={styles.actionBtn}
						onClick={toggleFullscreen}
						title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
					>
						{isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
					</button>
					<button
						className={styles.actionBtn}
						onClick={onClose}
						title="Close"
					>
						<CloseIcon />
					</button>
				</div>
			</div>

			{/* Terminal */}
			<div ref={terminalRef} className={styles.terminal} />
		</div>
	);
}

// ============================================================================
// Icons
// ============================================================================

function TerminalIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			width="14"
			height="14"
		>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	);
}

function FullscreenIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="14"
			height="14"
		>
			<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
		</svg>
	);
}

function ExitFullscreenIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="14"
			height="14"
		>
			<path d="M4 14h6m-6-4v6m16-6h-6m6 4v-6M10 4v6m4-6v6m-4 14v-6m4 6v-6" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="14"
			height="14"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
