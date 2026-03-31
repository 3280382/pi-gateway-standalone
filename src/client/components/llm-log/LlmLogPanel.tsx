/**
 * LlmLogPanel - LLM Log Viewer as Bottom Panel
 * Real-time log display with streaming updates
 */

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./LlmLogPanel.module.css";

interface LlmLogPanelProps {
	height: number;
	onClose: () => void;
	onHeightChange: (height: number) => void;
}

interface LogEntry {
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	message: string;
	details?: string;
}

export function LlmLogPanel({
	height,
	onClose,
	onHeightChange,
}: LlmLogPanelProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const isResizing = useRef(false);
	const resizeStartY = useRef(0);
	const resizeStartHeight = useRef(height);

	// Fetch logs from API
	const fetchLogs = useCallback(async () => {
		try {
			const response = await fetch("/api/llm-log");
			if (response.ok) {
				const data = await response.json();
				if (data.logs && Array.isArray(data.logs)) {
					// Parse log lines
					const parsedLogs: LogEntry[] = data.logs
						.map((line: string) => parseLogLine(line))
						.filter(Boolean) as LogEntry[];
					setLogs(parsedLogs);
				}
			}
		} catch (error) {
			console.error("[LlmLogPanel] Failed to fetch logs:", error);
		}
	}, []);

	// Parse a log line into structured format
	const parseLogLine = (line: string): LogEntry | null => {
		// Try to parse JSON logs
		try {
			const parsed = JSON.parse(line);
			if (parsed.timestamp && parsed.message) {
				return {
					timestamp: parsed.timestamp,
					level: parsed.level || "info",
					message: parsed.message,
					details: parsed.details,
				};
			}
		} catch {
			// Not JSON, parse as plain text
		}

		// Try to match common log patterns
		const match = line.match(
			/^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[.,]?\d*Z?)\s+(\w+)\s+(.*)$/i,
		);
		if (match) {
			return {
				timestamp: match[1],
				level: match[2].toLowerCase() as LogEntry["level"],
				message: match[3],
			};
		}

		// Fallback: treat entire line as message
		if (line.trim()) {
			return {
				timestamp: new Date().toISOString(),
				level: "info",
				message: line,
			};
		}

		return null;
	};

	// Initial fetch and polling
	useEffect(() => {
		setIsLoading(true);
		fetchLogs().finally(() => setIsLoading(false));

		// Poll for new logs every 2 seconds
		intervalRef.current = setInterval(fetchLogs, 2000);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [fetchLogs]);

	// Auto-scroll to bottom
	useEffect(() => {
		if (contentRef.current && autoScroll) {
			contentRef.current.scrollTop = contentRef.current.scrollHeight;
		}
	}, [logs, autoScroll]);

	// Handle manual scroll
	const handleScroll = useCallback(() => {
		if (!contentRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
		const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
		setAutoScroll(isAtBottom);
	}, []);

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
				150,
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

	const handleClear = useCallback(async () => {
		try {
			await fetch("/api/llm-log/clear", { method: "POST" });
			setLogs([]);
		} catch (error) {
			console.error("[LlmLogPanel] Failed to clear logs:", error);
		}
	}, []);

	const handleRefresh = useCallback(() => {
		setIsLoading(true);
		fetchLogs().finally(() => setIsLoading(false));
	}, [fetchLogs]);

	const formatTimestamp = (timestamp: string): string => {
		try {
			const date = new Date(timestamp);
			return date.toLocaleTimeString("en-US", {
				hour12: false,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			});
		} catch {
			return timestamp;
		}
	};

	const getLevelColor = (level: string): string => {
		switch (level.toLowerCase()) {
			case "error":
				return styles.error;
			case "warn":
			case "warning":
				return styles.warn;
			case "debug":
				return styles.debug;
			default:
				return styles.info;
		}
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
					<LogIcon />
					<span>LLM Logs</span>
					<span className={styles.logCount}>({logs.length})</span>
				</div>
				<div className={styles.actions}>
					<button
						className={`${styles.actionBtn} ${autoScroll ? styles.active : ""}`}
						onClick={() => setAutoScroll(!autoScroll)}
						title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
					>
						<ScrollIcon />
					</button>
					<button
						className={styles.actionBtn}
						onClick={handleRefresh}
						title="Refresh"
						disabled={isLoading}
					>
						<RefreshIcon />
					</button>
					<button
						className={styles.actionBtn}
						onClick={handleClear}
						title="Clear logs"
					>
						<ClearIcon />
					</button>
					<button className={styles.actionBtn} onClick={onClose} title="Close">
						<CloseIcon />
					</button>
				</div>
			</div>

			{/* Log content */}
			<div ref={contentRef} className={styles.content} onScroll={handleScroll}>
				{isLoading && logs.length === 0 ? (
					<div className={styles.loading}>Loading logs...</div>
				) : logs.length === 0 ? (
					<div className={styles.empty}>No logs available</div>
				) : (
					<div className={styles.logList}>
						{logs.map((log, index) => (
							<div
								key={index}
								className={`${styles.logEntry} ${getLevelColor(log.level)}`}
							>
								<span className={styles.logTime}>
									{formatTimestamp(log.timestamp)}
								</span>
								<span className={styles.logLevel}>
									{log.level.toUpperCase()}
								</span>
								<span className={styles.logMessage}>{log.message}</span>
								{log.details && (
									<pre className={styles.logDetails}>{log.details}</pre>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// Icons
function LogIcon() {
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
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<polyline points="10 9 9 9 8 9" />
		</svg>
	);
}

function ScrollIcon() {
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
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

function RefreshIcon() {
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
			<polyline points="23 4 23 10 17 10" />
			<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
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
			<polyline points="3 6 5 6 21 6" />
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
