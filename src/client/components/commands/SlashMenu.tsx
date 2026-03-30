/**
 * SlashMenu - 斜杠命令菜单
 */

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SlashMenu.module.css";
import { SLASH_COMMANDS } from "./slashCommands";

interface SlashMenuProps {
	isOpen: boolean;
	filter: string;
	onSelect: (command: string) => void;
	onClose: () => void;
}

export function SlashMenu({
	isOpen,
	filter,
	onSelect,
	onClose,
}: SlashMenuProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const menuRef = useRef<HTMLDivElement>(null);

	// Filter commands
	const filteredCommands = SLASH_COMMANDS.filter(
		(cmd) =>
			cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
			cmd.description.toLowerCase().includes(filter.toLowerCase()),
	);

	// Group by category
	const grouped = filteredCommands.reduce(
		(acc, cmd) => {
			if (!acc[cmd.category]) acc[cmd.category] = [];
			acc[cmd.category].push(cmd);
			return acc;
		},
		{} as Record<string, typeof SLASH_COMMANDS>,
	);

	const categoryOrder = ["session", "context", "tools", "help"];

	// Handle keyboard navigation
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!isOpen) return;

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex(
						(prev) =>
							(prev - 1 + filteredCommands.length) % filteredCommands.length,
					);
					break;
				case "Enter":
					e.preventDefault();
					if (filteredCommands[selectedIndex]) {
						onSelect(filteredCommands[selectedIndex].name);
					}
					break;
				case "Escape":
					e.preventDefault();
					onClose();
					break;
			}
		},
		[isOpen, filteredCommands, selectedIndex, onSelect, onClose],
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	// Reset selection when filter changes
	useEffect(() => {
		setSelectedIndex(0);
	}, [filter]);

	// Scroll selected into view
	useEffect(() => {
		const selected = menuRef.current?.querySelector(
			`[data-index="${selectedIndex}"]`,
		);
		selected?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	if (!isOpen || filteredCommands.length === 0) return null;

	let globalIndex = 0;

	return (
		<div className={styles.menu} ref={menuRef}>
			<div className={styles.header}>Available Commands</div>
			{categoryOrder.map((category) => {
				const commands = grouped[category];
				if (!commands || commands.length === 0) return null;

				return (
					<div key={category} className={styles.category}>
						<div className={styles.categoryHeader}>{category}</div>
						{commands.map((cmd) => {
							const index = globalIndex++;
							const isSelected = index === selectedIndex;

							return (
								<div
									key={cmd.name}
									className={`${styles.command} ${isSelected ? styles.selected : ""}`}
									data-index={index}
									onClick={() => onSelect(cmd.name)}
									onMouseEnter={() => setSelectedIndex(index)}
								>
									<span className={styles.icon}>{cmd.icon}</span>
									<span className={styles.name}>{cmd.name}</span>
									<span className={styles.description}>{cmd.description}</span>
								</div>
							);
						})}
					</div>
				);
			})}
		</div>
	);
}
