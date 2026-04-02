/**
 * InputArea - Modern minimal design with session control
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLASH_COMMANDS } from "@/features/chat/types/slashCommands";
import { browseDirectory } from "@/services/api/fileApi";
import { useFileStore } from "@/stores/fileStore";
import styles from "./InputArea.module.css";

interface InputAreaProps {
	value: string;
	isStreaming: boolean;
	onChange: (text: string) => void;
	onSend: () => void;
	onAbort: () => void;
	onBashCommand?: (command: string) => void;
	onSlashCommand?: (command: string, args: string) => void;
	onSendWithImages?: (text: string, images: ImageUpload[]) => void;
	onNewSession?: () => void;
}

export interface ImageUpload {
	id: string;
	file: File;
	preview: string;
	base64: string;
	mimeType: string;
	ocrText?: string;
	isProcessingOCR: boolean;
}

interface FileItem {
	name: string;
	path: string;
	isDirectory: boolean;
}

export function InputArea({
	value,
	isStreaming,
	onChange,
	onSend,
	onAbort,
	onBashCommand,
	onSlashCommand,
	onSendWithImages,
	onNewSession,
}: InputAreaProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [showCommands, setShowCommands] = useState(false);
	const [commandFilter, setCommandFilter] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);

	// @mention file selection
	const [showFilePicker, setShowFilePicker] = useState(false);
	const [fileFilter, setFileFilter] = useState("");
	const [fileList, setFileList] = useState<FileItem[]>([]);
	const [isLoadingFiles, setIsLoadingFiles] = useState(false);
	const [selectedFileIndex, setSelectedFileIndex] = useState(0);
	const { currentPath } = useFileStore();

	// Image uploads
	const [images, setImages] = useState<ImageUpload[]>([]);
	const [showImagePreview, setShowImagePreview] = useState(true);

	// Auto-resize textarea
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			const newHeight = Math.max(textarea.scrollHeight, 64);
			textarea.style.height = `${Math.min(newHeight, 200)}px`;
		}
	}, [value]);

	// Check for slash commands
	useEffect(() => {
		if (value.startsWith("/") && !value.includes(" ")) {
			const filter = value.slice(1).toLowerCase();
			setCommandFilter(filter);
			setShowCommands(true);
			setSelectedIndex(0);
		} else {
			setShowCommands(false);
		}
	}, [value]);

	// Check for @mention trigger
	useEffect(() => {
		const lastAtIndex = value.lastIndexOf("@");
		if (lastAtIndex !== -1) {
			const afterAt = value.slice(lastAtIndex + 1);
			// Show picker when @ is at word boundary (start of input, after space, or after newline)
			if (!afterAt.includes(" ")) {
				setFileFilter(afterAt.toLowerCase());
				setShowFilePicker(true);
				setSelectedFileIndex(0);
				loadFileList();
			} else {
				setShowFilePicker(false);
			}
		} else {
			setShowFilePicker(false);
		}
	}, [value]);

	const loadFileList = async (): Promise<void> => {
		setIsLoadingFiles(true);
		try {
			const data = await browseDirectory(currentPath);
			const items = [
				...(data.parentPath !== data.currentPath
					? [{ name: "..", path: data.parentPath, isDirectory: true }]
					: []),
				...data.items,
			];
			setFileList(items);
		} catch (err) {
			console.error("Failed to load files:", err);
			setFileList([]);
		} finally {
			setIsLoadingFiles(false);
		}
	};

	const isBashMode = useMemo(() => {
		return value.trimStart().startsWith("!");
	}, [value]);

	const filteredCommands = useMemo(() => {
		if (!commandFilter) return SLASH_COMMANDS;
		return SLASH_COMMANDS.filter(
			(cmd) =>
				cmd.name.toLowerCase().includes(commandFilter) ||
				cmd.description.toLowerCase().includes(commandFilter),
		);
	}, [commandFilter]);

	const filteredFiles = useMemo(() => {
		if (!fileFilter) return fileList;
		return fileList.filter(
			(f) =>
				f.name.toLowerCase().includes(fileFilter) ||
				f.path.toLowerCase().includes(fileFilter),
		);
	}, [fileFilter, fileList]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (showFilePicker && filteredFiles.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedFileIndex((prev) => (prev + 1) % filteredFiles.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedFileIndex((prev) =>
					prev <= 0 ? filteredFiles.length - 1 : prev - 1,
				);
				return;
			}
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (filteredFiles[selectedFileIndex]) {
					selectFile(filteredFiles[selectedFileIndex]);
				}
				return;
			}
			if (e.key === "Escape") {
				setShowFilePicker(false);
				return;
			}
		}

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

		if (
			e.key === "Enter" &&
			(e.ctrlKey || e.metaKey) &&
			!showCommands &&
			!showFilePicker
		) {
			e.preventDefault();
			handleSend();
			return;
		}

		if (
			e.key === "Enter" &&
			!e.shiftKey &&
			!e.ctrlKey &&
			!e.metaKey &&
			!showCommands &&
			!showFilePicker &&
			!isBashMode
		) {
			return;
		}
	};

	const handleSend = useCallback(() => {
		if (isStreaming) {
			onAbort();
			return;
		}

		const trimmedValue = value.trim();
		if (!trimmedValue && images.length === 0) return;

		if (isBashMode) {
			const command = trimmedValue.slice(1);
			if (onBashCommand) {
				onBashCommand(command);
			}
			onChange("");
			return;
		}

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

		if (images.length > 0 && onSendWithImages) {
			onSendWithImages(trimmedValue, images);
			onChange("");
			setImages([]);
			return;
		}

		onSend();
	}, [
		value,
		images,
		isStreaming,
		isBashMode,
		onSend,
		onAbort,
		onBashCommand,
		onSlashCommand,
		onSendWithImages,
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

	const selectFile = useCallback(
		(file: FileItem) => {
			const lastAtIndex = value.lastIndexOf("@");
			const beforeAt = value.slice(0, lastAtIndex);
			const afterAt = value.slice(lastAtIndex + 1 + fileFilter.length);
			const filePath = file.isDirectory ? `${file.path}/` : file.path;
			onChange(`${beforeAt}${filePath}${afterAt}`);
			setShowFilePicker(false);
			textareaRef.current?.focus();
		},
		[value, fileFilter, onChange],
	);

	const handleFileUpload = () => {
		fileInputRef.current?.click();
	};

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;

		for (const file of Array.from(files)) {
			const reader = new FileReader();
			reader.onload = async (event) => {
				const base64 = event.target?.result as string;
				const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

				const newImage: ImageUpload = {
					id: imageId,
					file,
					preview: base64,
					base64: base64.split(",")[1],
					mimeType: file.type,
					isProcessingOCR: file.type.startsWith("image/"),
				};

				setImages((prev) => [...prev, newImage]);

				if (file.type.startsWith("image/")) {
					try {
						const ocrText = await performOCR(base64, file.type);
						setImages((prev) =>
							prev.map((img) =>
								img.id === imageId
									? { ...img, ocrText, isProcessingOCR: false }
									: img,
							),
						);
					} catch (err) {
						setImages((prev) =>
							prev.map((img) =>
								img.id === imageId ? { ...img, isProcessingOCR: false } : img,
							),
						);
					}
				}
			};
			reader.readAsDataURL(file);
		}

		e.target.value = "";
	};

	const performOCR = async (
		base64Image: string,
		mimeType: string,
	): Promise<string> => {
		try {
			const response = await fetch("/api/ocr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ image: base64Image, mimeType }),
			});
			if (response.ok) {
				const data = await response.json();
				return data.text || "";
			}
		} catch (err) {
		}
		return "";
	};

	const removeImage = (id: string) => {
		setImages((prev) => prev.filter((img) => img.id !== id));
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
	};

	const insertAtCursor = (
		text: string,
		triggerAction?: "file" | "command" | "bash",
	) => {
		const textarea = textareaRef.current;
		if (!textarea) {
			onChange(value + text);
			return;
		}

		// Ensure textarea is focused first
		textarea.focus();

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const newValue = value.substring(0, start) + text + value.substring(end);
		onChange(newValue);

		// Set cursor position after the inserted text
		const newCursorPos = start + text.length;
		textarea.setSelectionRange(newCursorPos, newCursorPos);

		// Trigger corresponding action
		if (triggerAction === "file") {
			// Load files and show picker immediately
			loadFileList().then(() => {
				setFileFilter("");
				setShowFilePicker(true);
				setSelectedFileIndex(0);
			});
		} else if (triggerAction === "command") {
			setCommandFilter("");
			setShowCommands(true);
			setSelectedIndex(0);
		}
	};

	const placeholder = isStreaming
		? "Generating..."
		: isBashMode
			? "Enter bash command (Ctrl+Enter to execute)..."
			: "Message... Ctrl+Enter to send";

	return (
		<div className={styles.container}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept="image/*,.txt,.md,.json,.js,.ts,.py,.sh,.java,.cpp,.c,.h,.go,.rs,.php,.rb,.swift,.kt,.html,.css,.scss,.yaml,.yml,.xml"
				className={styles.hiddenInput}
				onChange={handleFileSelect}
			/>

			{showCommands && (
				<div className={styles.commandMenu}>
					{filteredCommands.length > 0 ? (
						filteredCommands.map((cmd, index) => (
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
						))
					) : (
						<div className={styles.loadingItem}>No commands found</div>
					)}
				</div>
			)}

			{showFilePicker && (
				<div className={styles.filePicker}>
					<div className={styles.filePickerHeader}>
						<FileIcon />
						<span>Select file or directory</span>
					</div>
					{isLoadingFiles ? (
						<div className={styles.loadingItem}>Loading files...</div>
					) : filteredFiles.length > 0 ? (
						filteredFiles.map((file, index) => (
							<button
								key={file.path}
								className={`${styles.fileItem} ${
									index === selectedFileIndex ? styles.selected : ""
								}`}
								onClick={() => selectFile(file)}
								onMouseEnter={() => setSelectedFileIndex(index)}
							>
								<span className={styles.fileIcon}>
									{file.isDirectory ? <FolderIcon /> : <DocIcon />}
								</span>
								<span className={styles.fileName}>{file.name}</span>
								<span className={styles.filePath}>{file.path}</span>
							</button>
						))
					) : (
						<div className={styles.loadingItem}>No files found</div>
					)}
				</div>
			)}

			{images.length > 0 && showImagePreview && (
				<div className={styles.imagePreviewBar}>
					{images.map((img) => (
						<div key={img.id} className={styles.imagePreviewItem}>
							<img src={img.preview} alt="Upload" />
							{img.isProcessingOCR && (
								<div className={styles.ocrIndicator}>⋯</div>
							)}
							{img.ocrText && <div className={styles.ocrBadge}>T</div>}
							<button
								className={styles.removeImageBtn}
								onClick={() => removeImage(img.id)}
							>
								<CloseIcon />
							</button>
						</div>
					))}
					<button
						className={styles.togglePreviewBtn}
						onClick={() => setShowImagePreview(false)}
					>
						Hide
					</button>
				</div>
			)}
			{images.length > 0 && !showImagePreview && (
				<div className={styles.imageCountBar}>
					<span>{images.length} image(s)</span>
					<button onClick={() => setShowImagePreview(true)}>Show</button>
				</div>
			)}

			<div className={styles.inputRow}>
				<textarea
					ref={textareaRef}
					className={`${styles.textarea} ${isBashMode ? styles.bashMode : ""}`}
					placeholder={placeholder}
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					rows={2}
					disabled={isStreaming}
				/>
				<div className={styles.buttonColumn}>
					<button
						className={`${styles.sendButton} ${isStreaming ? styles.stopButton : ""}`}
						onClick={handleSend}
						title={isStreaming ? "Stop" : "Send (Ctrl+Enter)"}
					>
						{isStreaming ? <StopIcon /> : <SendIcon />}
					</button>
					{onNewSession && (
						<button
							className={styles.newSessionButton}
							onClick={onNewSession}
							title="New Session"
							disabled={isStreaming}
						>
							<PlusIcon />
						</button>
					)}
				</div>
			</div>

			<div className={styles.toolbar}>
				<button
					className={styles.toolbarBtn}
					onClick={async () => {
						// Add @ at the end
						const newValue = value + "@";
						onChange(newValue);
						// Load files first
						await loadFileList();
						// Then show picker
						setFileFilter("");
						setShowFilePicker(true);
						setSelectedFileIndex(0);
						textareaRef.current?.focus();
					}}
					title="Mention file (@)"
					disabled={isStreaming}
				>
					<span className={styles.btnIcon}>@</span>
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={() => {
						// Add / at the end and trigger command menu immediately
						const newValue = value + "/";
						onChange(newValue);
						setCommandFilter("");
						setShowCommands(true);
						setSelectedIndex(0);
						textareaRef.current?.focus();
					}}
					title="Slash command (/)"
					disabled={isStreaming}
				>
					<span className={styles.btnIcon}>/</span>
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={() => insertAtCursor("!")}
					title="Bash command (!)"
					disabled={isStreaming}
				>
					<span className={styles.btnIcon}>!</span>
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={handleFileUpload}
					title="Upload image/file"
					disabled={isStreaming}
				>
					<ImageIcon />
				</button>
			</div>
		</div>
	);
}

function SendIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor">
			<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
		</svg>
	);
}

function StopIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="6" y="6" width="12" height="12" rx="2" />
		</svg>
	);
}

function PlusIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
}

function ImageIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<rect x="3" y="3" width="18" height="18" rx="3" />
			<circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
			<path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function FileIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z" />
			<polyline points="13 2 13 9 20 9" />
		</svg>
	);
}

function FolderIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor">
			<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
		</svg>
	);
}

function DocIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<polyline points="10 9 9 9 8 9" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
