/**
 * InputArea - Clean, minimal design with icons
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLASH_COMMANDS } from "../../commands/slashCommands";
import styles from "./InputArea.module.css";

interface InputAreaProps {
	value: string;
	isStreaming: boolean;
	onChange: (text: string) => void;
	onSend: () => void;
	onAbort: () => void;
	onBashCommand?: (command: string) => void;
	onSlashCommand?: (command: string, args: string) => void;
}

export function InputArea({
	value,
	isStreaming,
	onChange,
	onSend,
	onAbort,
	onBashCommand,
	onSlashCommand,
}: InputAreaProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [showCommands, setShowCommands] = useState(false);
	const [commandFilter, setCommandFilter] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);

	// Auto-resize textarea
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
		}
	}, [value]);

	// Check for slash commands
	useEffect(() => {
		if (value.startsWith("/")) {
			const filter = value.slice(1).toLowerCase();
			setCommandFilter(filter);
			setShowCommands(true);
			setSelectedIndex(0);
		} else {
			setShowCommands(false);
		}
	}, [value]);

	// Check if in bash mode
	const isBashMode = useMemo(() => {
		return value.trimStart().startsWith("!");
	}, [value]);

	// Filtered commands
	const filteredCommands = useMemo(() => {
		if (!commandFilter) return SLASH_COMMANDS;
		return SLASH_COMMANDS.filter(
			(cmd) =>
				cmd.name.toLowerCase().includes(commandFilter) ||
				cmd.description.toLowerCase().includes(commandFilter),
		);
	}, [commandFilter]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Command menu navigation
		if (showCommands && filteredCommands.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) =>
					prev <= 0 ? filteredCommands.length - 1 : prev - 1,
				);
				return;
			}
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (filteredCommands[selectedIndex]) {
					selectCommand(filteredCommands[selectedIndex]);
				}
				return;
			}
			if (e.key === "Escape") {
				setShowCommands(false);
				return;
			}
		}

		// Ctrl+Enter to send
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSend();
			return;
		}

		// Regular Enter (without shift) for send (not in bash mode)
		if (e.key === "Enter" && !e.shiftKey && !showCommands && !isBashMode) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleSend = useCallback(() => {
		if (isStreaming) {
			onAbort();
			return;
		}

		const trimmedValue = value.trim();
		if (!trimmedValue) return;

		// Handle bash commands
		if (isBashMode) {
			const command = trimmedValue.slice(1);
			if (onBashCommand) {
				onBashCommand(command);
			}
			onChange("");
			return;
		}

		// Handle slash commands
		if (trimmedValue.startsWith("/")) {
			const parts = trimmedValue.slice(1).split(" ");
			const cmd = parts[0];
			const args = parts.slice(1).join(" ");

			if (onSlashCommand) {
				onSlashCommand(cmd, args);
			}
			onChange("");
			return;
		}

		// Regular message
		onSend();
	}, [
		value,
		isStreaming,
		isBashMode,
		onSend,
		onAbort,
		onBashCommand,
		onSlashCommand,
		onChange,
	]);

	const selectCommand = useCallback(
		(command: (typeof SLASH_COMMANDS)[0]) => {
			const commandText = `${command.name} `;
			onChange(commandText);
			setShowCommands(false);
			textareaRef.current?.focus();
		},
		[onChange],
	);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
	};

	const placeholder = isStreaming
		? "Generating..."
		: isBashMode
			? "Enter bash command..."
			: "Message...";

	return (
		<div className={styles.container}>
			{/* Bash mode indicator */}
			{isBashMode && (
				<div className={styles.modeIndicator}>
					<TerminalIcon />
				</div>
			)}

			{/* Slash command menu */}
			{showCommands && filteredCommands.length > 0 && (
				<div className={styles.commandMenu}>
					{filteredCommands.map((cmd, index) => (
						<button
							key={cmd.name}
							className={`${styles.commandItem} ${
								index === selectedIndex ? styles.selected : ""
							}`}
							onClick={() => selectCommand(cmd)}
							onMouseEnter={() => setSelectedIndex(index)}
						>
							<span className={styles.commandIcon}>{cmd.icon}</span>
							<span className={styles.commandName}>{cmd.name}</span>
						</button>
					))}
				</div>
			)}

			<div className={styles.inputWrapper}>
				<textarea
					ref={textareaRef}
					className={`${styles.textarea} ${isBashMode ? styles.bashMode : ""}`}
					placeholder={placeholder}
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					rows={1}
					disabled={isStreaming}
				/>
				<button
					className={`${styles.sendButton} ${isStreaming ? styles.stopButton : ""}`}
					onClick={handleSend}
					title={isStreaming ? "Stop" : "Send"}
				>
					{isStreaming ? <StopIcon /> : <SendIcon />}
				</button>
			</div>
		</div>
	);
}

// Send Icon (paper plane)
function SendIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="22" y1="2" x2="11" y2="13" />
			<polygon points="22 2 15 22 11 13 2 9 22 2" />
		</svg>
	);
}

// Stop Icon (square)
function StopIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
			<rect x="6" y="6" width="12" height="12" rx="2" />
		</svg>
	);
}

// Terminal Icon
function TerminalIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	);
}
