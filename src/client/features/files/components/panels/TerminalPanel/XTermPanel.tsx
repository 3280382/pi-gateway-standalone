/**
 * XTermPanel - Real xterm.js terminal for file operations
 *
 * 职责：纯 UI 渲染
 * - 不包含业务逻辑
 * - 通过 useXTerm hook 获取所有逻辑
 */

import { useCallback, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/features/files/stores";
import { useXTerm } from "@/features/files/hooks";
import "@xterm/xterm/css/xterm.css";

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
	const currentDir = useWorkspaceStore((state) => state.currentDir);
	const { terminalRef, isFullscreen, toggleFullscreen } = useXTerm({
		currentDir,
		onExecuteCommand,
		initialCommand,
	});

	// Resize handlers
	const isResizing = useRef(false);
	const resizeStartY = useRef(0);
	const resizeStartHeight = useRef(height);

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

// Icons
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
