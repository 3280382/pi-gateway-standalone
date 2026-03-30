/**
 * LlmLogModal - LLM Log Viewer
 * Real-time log display with configuration options
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LlmLogConfig, LlmLogEntry } from "@/stores/sidebarExtrasStore";
import { useSidebarExtrasStore } from "@/stores/sidebarExtrasStore";
import styles from "./LlmLogModal.module.css";

export function LlmLogModal() {
	const isOpen = useSidebarExtrasStore((state) => state.isLlmLogOpen);
	const logs = useSidebarExtrasStore((state) => state.llmLogs);
	const config = useSidebarExtrasStore((state) => state.llmLogConfig);
	const closeLlmLog = useSidebarExtrasStore((state) => state.closeLlmLog);
	const addLog = useSidebarExtrasStore((state) => state.addLlmLog);
	const clearLogs = useSidebarExtrasStore((state) => state.clearLlmLogs);
	const setConfig = useSidebarExtrasStore((state) => state.setLlmLogConfig);

	const [showConfig, setShowConfig] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	// Auto-scroll to bottom when new logs arrive
	useEffect(() => {
		if (contentRef.current && config.enabled) {
			contentRef.current.scrollTop = contentRef.current.scrollHeight;
		}
	}, [logs, config.enabled]);

	// Simulate log fetching (replace with actual API/WebSocket)
	useEffect(() => {
		if (!isOpen || !config.enabled) {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			return;
		}

		const fetchLogs = async () => {
			try {
				const response = await fetch("/api/logs/llm");
				if (response.ok) {
					const data = await response.json();
					if (data.logs && Array.isArray(data.logs)) {
						data.logs.forEach((log: LlmLogEntry) => {
							addLog(log);
						});
					}
				}
			} catch (error) {
				// Silently fail - logs are not critical
			}
		};

		// Initial fetch
		fetchLogs();

		// Set up interval
		if (config.refreshInterval > 0) {
			intervalRef.current = setInterval(
				fetchLogs,
				config.refreshInterval * 1000,
			);
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [isOpen, config.enabled, config.refreshInterval, addLog]);

	const handleClose = useCallback(() => {
		closeLlmLog();
	}, [closeLlmLog]);

	const handleClear = useCallback(() => {
		clearLogs();
	}, [clearLogs]);

	const handleToggleConfig = useCallback(() => {
		setShowConfig((prev) => !prev);
	}, []);

	const handleToggleEnabled = useCallback(() => {
		setConfig({ enabled: !config.enabled });
	}, [config.enabled, setConfig]);

	const handleRefreshIntervalChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			setConfig({ refreshInterval: parseInt(e.target.value, 10) });
		},
		[setConfig],
	);

	const handleTruncateChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			setConfig({ truncateLength: parseInt(e.target.value, 10) });
		},
		[setConfig],
	);

	// Close on Escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				handleClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, handleClose]);

	// Prevent body scroll when modal is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		<div className={styles.overlay} onClick={handleClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<h2 className={styles.title}>LLM Logs</h2>
					<div className={styles.headerActions}>
						<button
							className={`${styles.headerBtn} ${config.enabled ? styles.active : ""}`}
							onClick={handleToggleEnabled}
							title={config.enabled ? "Disable logging" : "Enable logging"}
						>
							{config.enabled ? <PauseIcon /> : <PlayIcon />}
						</button>
						<button
							className={`${styles.headerBtn} ${showConfig ? styles.active : ""}`}
							onClick={handleToggleConfig}
							title="Configuration"
						>
							<SettingsIcon />
						</button>
						<button
							className={styles.headerBtn}
							onClick={handleClear}
							title="Clear logs"
						>
							<ClearIcon />
						</button>
						<button
							className={styles.closeBtn}
							onClick={handleClose}
							aria-label="Close"
						>
							<CloseIcon />
						</button>
					</div>
				</div>

				{showConfig && (
					<div className={styles.config}>
						<div className={styles.configRow}>
							<label className={styles.configLabel}>Refresh Interval:</label>
							<select
								className={styles.configSelect}
								value={config.refreshInterval}
								onChange={handleRefreshIntervalChange}
							>
								<option value={1}>1 second</option>
								<option value={5}>5 seconds</option>
								<option value={10}>10 seconds</option>
								<option value={30}>30 seconds</option>
								<option value={60}>1 minute</option>
							</select>
						</div>
						<div className={styles.configRow}>
							<label className={styles.configLabel}>Max Lines:</label>
							<select
								className={styles.configSelect}
								value={config.truncateLength}
								onChange={handleTruncateChange}
							>
								<option value={100}>100 lines</option>
								<option value={500}>500 lines</option>
								<option value={1000}>1,000 lines</option>
								<option value={5000}>5,000 lines</option>
							</select>
						</div>
					</div>
				)}

				<div className={styles.content} ref={contentRef}>
					{logs.length === 0 ? (
						<div className={styles.empty}>
							{config.enabled ? "No logs yet..." : "Logging is disabled"}
						</div>
					) : (
						<div className={styles.logList}>
							{logs.map((log, index) => (
								<div
									key={index}
									className={`${styles.logEntry} ${styles[log.level]}`}
								>
									<span className={styles.logTime}>
										{formatTimestamp(log.timestamp)}
									</span>
									<span className={styles.logLevel}>
										{log.level.toUpperCase()}
									</span>
									<span className={styles.logMessage}>{log.message}</span>
								</div>
							))}
						</div>
					)}
				</div>

				<div className={styles.footer}>
					<span className={styles.status}>
						{logs.length} lines | {config.enabled ? "Live" : "Paused"}
					</span>
				</div>
			</div>
		</div>
	);
}

function formatTimestamp(timestamp: string): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function CloseIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="16"
			height="16"
		>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

function PlayIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="16"
			height="16"
		>
			<polygon points="5 3 19 12 5 21 5 3" />
		</svg>
	);
}

function PauseIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="16"
			height="16"
		>
			<rect x="6" y="4" width="4" height="16" />
			<rect x="14" y="4" width="4" height="16" />
		</svg>
	);
}

function SettingsIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="16"
			height="16"
		>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</svg>
	);
}

function ClearIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			width="16"
			height="16"
		>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	);
}
