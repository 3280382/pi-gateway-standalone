/**
 * Settings Section - Ultra Compact
 */

import { useSidebarController } from "@/services/api/sidebarApi";
import { useLlmLogStore } from "@/stores/llmLogStore";
import { useModalStore } from "@/stores/modalStore";
import { useSidebarStore } from "@/stores/sidebarStore";
import type { FontSize, Theme } from "@/types/sidebar";
import { SectionHeader } from "@/shared/components/ui";
import styles from "./Settings.module.css";

export function Settings() {
	const theme = useSidebarStore((state) => state.theme);
	const fontSize = useSidebarStore((state) => state.fontSize);
	const controller = useSidebarController();

	// LLM Log settings from llmLogStore
	const llmLogConfig = useLlmLogStore((state) => state.config);
	const setLlmLogConfig = useLlmLogStore((state) => state.setConfig);
	const openLlmLog = useModalStore((state) => state.openLlmLog);

	return (
		<section className={styles.section}>
			<SectionHeader title="Settings" />

			{/* Theme Selector */}
			<div className={styles.setting}>
				<span className={styles.label}>Theme</span>
				<div className={styles.themeSelector}>
					<ThemeButton
						theme="dark"
						isActive={theme === "dark"}
						onClick={() => controller.setTheme("dark")}
						icon={<MoonIcon />}
						label="Dark"
					/>
					<ThemeButton
						theme="light"
						isActive={theme === "light"}
						onClick={() => controller.setTheme("light")}
						icon={<SunIcon />}
						label="Light"
					/>
				</div>
			</div>

			{/* Font Size Selector */}
			<div className={styles.setting}>
				<span className={styles.label}>Font</span>
				<div className={styles.fontSizeSelector}>
					{(["tiny", "small", "medium", "large"] as FontSize[]).map((size) => (
						<button
							key={size}
							className={`${styles.fontSizeBtn} ${
								fontSize === size ? styles.active : ""
							}`}
							onClick={() => controller.setFontSize(size)}
							title={size}
						>
							<FontSizeIcon size={size} />
						</button>
					))}
				</div>
			</div>

			{/* LLM Log Settings */}
			<div className={styles.setting}>
				<span className={styles.label}>LLM Log</span>
				<div className={styles.logControls}>
					<button
						className={`${styles.toggleBtn} ${llmLogConfig.enabled ? styles.enabled : ""}`}
						onClick={() => setLlmLogConfig({ enabled: !llmLogConfig.enabled })}
						title={
							llmLogConfig.enabled ? "Logging enabled" : "Logging disabled"
						}
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

			{/* Log Refresh Interval */}
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

function ThemeButton({
	isActive,
	onClick,
	icon,
	label,
}: {
	theme: Theme;
	isActive: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
}) {
	return (
		<button
			className={`${styles.themeBtn} ${isActive ? styles.active : ""}`}
			onClick={onClick}
			title={label}
		>
			{icon}
		</button>
	);
}

function FontSizeIcon({ size }: { size: FontSize }) {
	const sizes = { tiny: 10, small: 12, medium: 14, large: 16 };
	return <span style={{ fontSize: sizes[size], fontWeight: "bold" }}>A</span>;
}

function MoonIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	);
}

function SunIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
		</svg>
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
