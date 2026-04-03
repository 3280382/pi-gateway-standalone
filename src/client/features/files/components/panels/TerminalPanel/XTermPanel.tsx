/**
 * XTermPanel - Real xterm.js terminal for file operations
 */

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { useSessionStore } from "@/shared/stores/sessionStore";

interface XTermPanelProps {
	height: number;
	onClose: () => void;
	onHeightChange: (height: number) => void;
	onExecuteCommand?: (command: string) => void;
	initialCommand?: string;
}

export default function XTermPanel({
	height,
	onClose,
	onHeightChange,
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
	const [isFullscreen, setIsFullscreen] = useState(false);

	const toggleFullscreen = () => {
		setIsFullscreen(!isFullscreen);
	};

	// Initialize terminal
	useEffect(() => {
		if (!terminalRef.current || terminalInstance.current) return;

		const container = terminalRef.current;

		// Ensure container has size
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
				"[XTermPanel] Terminal initialized:",
				term.cols,
				"x",
				term.rows,
			);
		});

		// Execute command on server
		const executeCommand = async (command: string) => {
			try {
				if (abortControllerRef.current) {
					abortControllerRef.current.abort();
				}
				abortControllerRef.current = new AbortController();

				const response = await fetch("/api/execute", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ command, cwd: currentDir, streaming: true }),
					signal: abortControllerRef.current.signal,
				});

				if (!response.ok) {
					const error = await response.text();
					term.writeln(`\x1b[31mError: ${error}\x1b[0m`);
					return;
				}

				const reader = response.body?.getReader();
				if (!reader) {
					term.writeln("\x1b[31mError: No response body\x1b[0m");
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
						term.writeln(line);
					}
				}

				if (buffer) {
					term.write(buffer);
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

			if (code === 13) {
				// Enter
				term.writeln("");
				if (commandBuffer.current.trim()) {
					const cmd = commandBuffer.current;
					if (onExecuteCommand) onExecuteCommand(cmd);
					executeCommand(cmd).then(() => prompt(term));
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

		if (initialCommand) {
			term.writeln(`$ ${initialCommand}`);
			if (onExecuteCommand) onExecuteCommand(initialCommand);
			executeCommand(initialCommand).then(() => prompt(term));
		}

		const handleResize = () => fit.fit();
		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			if (abortControllerRef.current) abortControllerRef.current.abort();
			term.dispose();
			terminalInstance.current = null;
		};
	}, [onExecuteCommand, initialCommand, currentDir]);

	// Update height
	useEffect(() => {
		if (terminalInstance.current && fitAddon.current) {
			setTimeout(() => fitAddon.current?.fit(), 0);
		}
	}, [height]);

	const prompt = (term: Terminal) => term.write("\x1b[36m$\x1b[0m ");

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

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				background: "#0d1117",
				borderTop: isFullscreen ? "none" : "1px solid #30363d",
				overflow: "hidden",
				height: isFullscreen ? "100vh" : `${height}px`,
				flexShrink: 0,
				position: isFullscreen ? "fixed" : "relative",
				top: isFullscreen ? 0 : "auto",
				left: isFullscreen ? 0 : "auto",
				right: isFullscreen ? 0 : "auto",
				bottom: isFullscreen ? 0 : "auto",
				zIndex: isFullscreen ? 1000 : "auto",
			}}
		>
			{/* Resize handle */}
			{!isFullscreen && (
				<div
					onMouseDown={handleResizeStart}
					style={{
						height: "4px",
						background: "transparent",
						cursor: "ns-resize",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
					}}
				>
					<div
						style={{
							width: "40px",
							height: "2px",
							background: "#484f58",
							borderRadius: "2px",
						}}
					/>
				</div>
			)}

			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "6px 12px",
					background: "#161b22",
					borderBottom: "1px solid #30363d",
					flexShrink: 0,
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						fontSize: "13px",
						fontWeight: 500,
						color: "#e6edf3",
					}}
				>
					<TerminalIcon />
					<span>Terminal</span>
				</div>
				<div style={{ display: "flex", gap: "4px" }}>
					<button
						onClick={toggleFullscreen}
						title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
						style={actionBtnStyle}
					>
						{isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
					</button>
					<button onClick={onClose} title="Close" style={actionBtnStyle}>
						<CloseIcon />
					</button>
				</div>
			</div>

			{/* Terminal */}
			<div
				ref={terminalRef}
				style={{
					flex: 1,
					minHeight: 0,
					padding: "4px 8px",
					background: "#0d1117",
				}}
			/>
		</div>
	);
}

const actionBtnStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: "24px",
	height: "24px",
	padding: 0,
	border: "none",
	background: "transparent",
	color: "#8b949e",
	borderRadius: "4px",
	cursor: "pointer",
};

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
