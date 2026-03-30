/**
 * LlmLogPanel - 底部固定式 LLM 日志面板
 * 类似终端的固定底部面板
 */

import { useEffect, useRef, useState } from "react";
import { useSidebarExtrasStore } from "@/stores/sidebarExtrasStore";
import styles from "./LlmLogPanel.module.css";

interface LlmLogPanelProps {
	height: number;
	onClose: () => void;
	onHeightChange: (height: number) => void;
}

export function LlmLogPanel({
	height,
	onClose,
	onHeightChange,
}: LlmLogPanelProps) {
	const { llmLogs, llmLogConfig, setLlmLogConfig, clearLlmLogs } =
		useSidebarExtrasStore();
	const [isResizing, setIsResizing] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
	const startYRef = useRef(0);
	const startHeightRef = useRef(height);

	// 处理拖拽调整大小
	useEffect(() => {
		if (!isResizing) return;

		const handleMouseMove = (e: MouseEvent) => {
			const deltaY = startYRef.current - e.clientY;
			const newHeight = Math.max(
				100,
				Math.min(600, startHeightRef.current + deltaY),
			);
			onHeightChange(newHeight);
		};

		const handleMouseUp = () => {
			setIsResizing(false);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isResizing, onHeightChange]);

	const startResize = (e: React.MouseEvent) => {
		setIsResizing(true);
		startYRef.current = e.clientY;
		startHeightRef.current = height;
	};

	// 格式化时间戳
	const formatTime = (timestamp: string) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString("en-US", {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	// 获取日志级别颜色
	const getLevelColor = (level: string) => {
		switch (level) {
			case "error":
				return styles.levelError;
			case "warn":
				return styles.levelWarn;
			case "debug":
				return styles.levelDebug;
			default:
				return styles.levelInfo;
		}
	};

	return (
		<div
			ref={panelRef}
			className={styles.panel}
			style={{ height: `${height}px` }}
		>
			{/* 拖拽调整大小的手柄 */}
			<div className={styles.resizeHandle} onMouseDown={startResize}>
				<div className={styles.resizeLine} />
			</div>

			{/* 头部工具栏 */}
			<div className={styles.header}>
				<div className={styles.title}>
					<LogIcon />
					<span>LLM Log</span>
					<span className={styles.count}>({llmLogs.length})</span>
				</div>

				<div className={styles.controls}>
					{/* 启用/禁用切换 */}
					<button
						className={`${styles.toggleBtn} ${llmLogConfig.enabled ? styles.enabled : ""}`}
						onClick={() => setLlmLogConfig({ enabled: !llmLogConfig.enabled })}
						title={llmLogConfig.enabled ? "Disable logging" : "Enable logging"}
					>
						{llmLogConfig.enabled ? "On" : "Off"}
					</button>

					{/* 刷新间隔选择 */}
					<select
						className={styles.select}
						value={llmLogConfig.refreshInterval}
						onChange={(e) =>
							setLlmLogConfig({ refreshInterval: Number(e.target.value) })
						}
						title="Refresh interval"
					>
						<option value={1}>1s</option>
						<option value={5}>5s</option>
						<option value={10}>10s</option>
						<option value={30}>30s</option>
						<option value={60}>1m</option>
					</select>

					{/* 清空按钮 */}
					<button
						className={styles.clearBtn}
						onClick={clearLlmLogs}
						title="Clear logs"
					>
						<ClearIcon />
					</button>

					{/* 关闭按钮 */}
					<button
						className={styles.closeBtn}
						onClick={onClose}
						title="Close panel"
					>
						<CloseIcon />
					</button>
				</div>
			</div>

			{/* 日志内容区域 */}
			<div className={styles.content}>
				{!llmLogConfig.enabled ? (
					<div className={styles.disabledMessage}>
						<span>Logging is disabled. Enable it to see LLM logs.</span>
					</div>
				) : llmLogs.length === 0 ? (
					<div className={styles.emptyMessage}>
						<span>No logs yet. Logs will appear here when available.</span>
					</div>
				) : (
					<div className={styles.logList}>
						{llmLogs.map((log, index) => (
							<div key={index} className={styles.logEntry}>
								<span className={styles.timestamp}>
									{formatTime(log.timestamp)}
								</span>
								<span className={`${styles.level} ${getLevelColor(log.level)}`}>
									{log.level.toUpperCase()}
								</span>
								<span className={styles.message}>{log.message}</span>
								{log.metadata && (
									<pre className={styles.metadata}>
										{JSON.stringify(log.metadata, null, 2)}
									</pre>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// 日志图标
function LogIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<polyline points="10 9 9 9 8 9" />
		</svg>
	);
}

// 清空图标
function ClearIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	);
}

// 关闭图标
function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
