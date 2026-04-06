/**
 * ChatSettings - Chat 功能特有的设置
 * 包含：LLM Log 开关和刷新间隔
 */

import { useLlmLogStore } from "@/features/chat/stores/llmLogStore";
import { useModalStore } from "@/features/chat/stores/modalStore";
import styles from "@/features/chat/components/sidebar/ChatSettings/ChatSettings.module.css";

export function ChatSettings() {
	const llmLogConfig = useLlmLogStore((state) => state.config);
	const setLlmLogConfig = useLlmLogStore((state) => state.setConfig);
	const openLlmLog = useModalStore((state) => state.openLlmLog);

	return (
		<section className={styles.section}>
			<div className={styles.header}>Chat Settings</div>

			{/* LLM Log */}
			<div className={styles.setting}>
				<span className={styles.label}>LLM Log</span>
				<div className={styles.controls}>
					<button
						className={`${styles.toggleBtn} ${llmLogConfig.enabled ? styles.enabled : ""}`}
						onClick={() => setLlmLogConfig({ enabled: !llmLogConfig.enabled })}
						title={llmLogConfig.enabled ? "Logging enabled" : "Logging disabled"}
					>
						<LogIcon />
						<span>{llmLogConfig.enabled ? "On" : "Off"}</span>
					</button>

					<button
						className={styles.viewBtn}
						onClick={openLlmLog}
						title="View LLM Logs"
					>
						<ViewIcon />
					</button>
				</div>
			</div>

			{/* Refresh Interval */}
			{llmLogConfig.enabled && (
				<div className={styles.setting}>
					<span className={styles.label}>Refresh</span>
					<select
						className={styles.select}
						value={llmLogConfig.refreshInterval}
						onChange={(e) =>
							setLlmLogConfig({ refreshInterval: Number(e.target.value) })
						}
					>
						<option value={1}>1s</option>
						<option value={5}>5s</option>
						<option value={10}>10s</option>
						<option value={30}>30s</option>
						<option value={60}>1m</option>
					</select>
				</div>
			)}
		</section>
	);
}

function LogIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
		</svg>
	);
}

function ViewIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}
