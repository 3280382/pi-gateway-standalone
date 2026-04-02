/**
 * ThinkingSelector - Thinking level selection dropdown
 */

import { useEffect, useRef, useState } from "react";
import type { ThinkingLevel, ThinkingSelectorProps } from "../../types";
import styles from "./ThinkingSelector.module.css";

const THINKING_LEVELS: ThinkingLevel[] = [
	{ id: "off", name: "None", icon: "○" },
	{ id: "minimal", name: "Low", icon: "◐" },
	{ id: "low", name: "Med", icon: "◑" },
	{ id: "medium", name: "High", icon: "◒" },
	{ id: "high", name: "XHigh", icon: "●" },
];

// Icons
function ThinkingIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="16" x2="12" y2="12" />
			<line x1="12" y1="8" x2="12.01" y2="8" />
		</svg>
	);
}

function DropdownIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

export function ThinkingSelector({
	currentLevel,
	isStreaming,
	onSelect,
}: ThinkingSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const currentThinking =
		THINKING_LEVELS.find((t) => t.id === currentLevel) || THINKING_LEVELS[2];

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, []);

	const handleSelect = (level: string) => {
		onSelect(level);
		setIsOpen(false);
	};

	return (
		<div className={styles.container} ref={containerRef}>
			<button
				className={styles.selector}
				onClick={() => setIsOpen(!isOpen)}
				disabled={isStreaming}
				title="Thinking Level"
			>
				<ThinkingIcon />
				<span className={styles.text}>
					{currentThinking.icon} {currentThinking.name}
				</span>
				<DropdownIcon />
			</button>
			{isOpen && (
				<div className={styles.dropdown}>
					{THINKING_LEVELS.map((level) => (
						<div
							key={level.id}
							className={`${styles.item} ${level.id === currentLevel ? styles.active : ""}`}
							onClick={() => handleSelect(level.id)}
						>
							<span className={styles.icon}>{level.icon}</span>
							<span className={styles.name}>{level.name}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
