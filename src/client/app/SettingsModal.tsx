/**
 * SettingsModal - 全局设置弹窗
 */

import { useEffect } from "react";
import styles from "@/app/SettingsModal.module.css";
import { type FontSize, type Theme, useAppStore } from "@/stores/appStore";

export function SettingsModal() {
	const { theme, setTheme, fontSize, setFontSize } = useAppStore();

	// 应用主题到 document.body
	useEffect(() => {
		document.body.setAttribute("data-theme", theme);
	}, [theme]);

	// 应用字体大小到 CSS 变量
	useEffect(() => {
		const sizes = {
			tiny: "12px",
			small: "14px",
			medium: "16px",
			large: "18px",
		};
		document.documentElement.style.setProperty(
			"--app-font-size",
			sizes[fontSize],
		);
	}, [fontSize]);

	return (
		<div className={styles.modal}>
			<h3 className={styles.title}>Settings</h3>

			{/* Theme */}
			<div className={styles.setting}>
				<span className={styles.label}>Theme</span>
				<div className={styles.themeSelector}>
					<ThemeButton
						theme="dark"
						isActive={theme === "dark"}
						onClick={() => setTheme("dark")}
						icon={<MoonIcon />}
					/>
					<ThemeButton
						theme="light"
						isActive={theme === "light"}
						onClick={() => setTheme("light")}
						icon={<SunIcon />}
					/>
				</div>
			</div>

			{/* Font Size */}
			<div className={styles.setting}>
				<span className={styles.label}>Font Size</span>
				<div className={styles.fontSizeSelector}>
					{(["tiny", "small", "medium", "large"] as FontSize[]).map((size) => (
						<button
							key={size}
							className={`${styles.fontSizeBtn} ${fontSize === size ? styles.active : ""}`}
							onClick={() => setFontSize(size)}
							title={size}
						>
							<FontSizeIcon size={size} />
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function ThemeButton({
	theme,
	isActive,
	onClick,
	icon,
}: {
	theme: Theme;
	isActive: boolean;
	onClick: () => void;
	icon: React.ReactNode;
}) {
	return (
		<button
			className={`${styles.themeBtn} ${isActive ? styles.active : ""}`}
			onClick={onClick}
			title={theme}
		>
			{icon}
		</button>
	);
}

function FontSizeIcon({ size }: { size: FontSize }) {
	const sizes = { tiny: 10, small: 12, medium: 14, large: 16 };
	return <span style={{ fontSize: sizes[size], fontWeight: "bold" }}>A</span>;
}

// Icons
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
