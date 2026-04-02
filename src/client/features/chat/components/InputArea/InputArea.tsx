/**
 * InputArea - Enhanced with @file mention and image upload
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLASH_COMMANDS } from "@/features/chat/types/slashCommands";
import { useFileStore } from "@/stores/fileStore";
import { browseDirectory } from "@/services/api/fileApi";
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
	const [selectedFileIndex, setSelectedFileIndex] = useState(0);
	const { currentPath } = useFileStore();
	
	// Image uploads
	const [images, setImages] = useState<ImageUpload[]>([]);
	const [showImagePreview, setShowImagePreview] = useState(true);

	// Default to 2 rows height
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			const newHeight = Math.max(textarea.scrollHeight, 56); // min 56px for 2 rows
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
			// Only show if no space after @ and not in the middle of a word
			if (!afterAt.includes(" ") && (lastAtIndex === 0 || value[lastAtIndex - 1] === " ")) {
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

	const loadFileList = async () => {
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
		}
	};

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

	// Filtered files for @mention
	const filteredFiles = useMemo(() => {
		if (!fileFilter) return fileList;
		return fileList.filter(
			(f) =>
				f.name.toLowerCase().includes(fileFilter) ||
				f.path.toLowerCase().includes(fileFilter),
		);
	}, [fileFilter, fileList]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// File picker navigation
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

		// Enter without modifier = newline (allows IME enter for new line)
		// Ctrl/Cmd + Enter = send
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !showCommands && !showFilePicker) {
			e.preventDefault();
			handleSend();
			return;
		}

		// In bash mode, allow Enter for multi-line, use Ctrl+Enter to execute
		if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !showCommands && !showFilePicker && !isBashMode) {
			// Let it insert newline (default behavior for textarea)
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

		// Send with images if present
		if (images.length > 0 && onSendWithImages) {
			onSendWithImages(trimmedValue, images);
			onChange("");
			setImages([]);
			return;
		}

		// Regular message
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

				// Process OCR for images
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
						console.error("OCR failed:", err);
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

		// Clear input
		e.target.value = "";
	};

	const performOCR = async (base64Image: string, mimeType: string): Promise<string> => {
		// Use the backend OCR endpoint if available, or fallback to local processing
		// For now, we'll send a request to process the image
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
			console.log("OCR endpoint not available, using image without OCR");
		}
		return "";
	};

	const removeImage = (id: string) => {
		setImages((prev) => prev.filter((img) => img.id !== id));
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
	};

	const placeholder = isStreaming
		? "Generating..."
		: isBashMode
			? "Enter bash command..."
			: "Message... (Ctrl+Enter to send)";

	return (
		<div className={styles.container}>
			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept="image/*,.txt,.md,.json,.js,.ts,.py,.sh,.java,.cpp,.c,.h,.go,.rs,.php,.rb,.swift,.kt,.html,.css,.scss,.yaml,.yml,.xml"
				className={styles.hiddenInput}
				onChange={handleFileSelect}
			/>

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

			{/* File picker for @mention */}
			{showFilePicker && filteredFiles.length > 0 && (
				<div className={styles.filePicker}>
					<div className={styles.filePickerHeader}>
						<FileIcon />
						<span>Select file or directory</span>
					</div>
					{filteredFiles.map((file, index) => (
						<button
							key={file.path}
							className={`${styles.fileItem} ${
								index === selectedFileIndex ? styles.selected : ""
							}`}
							onClick={() => selectFile(file)}
							onMouseEnter={() => setSelectedFileIndex(index)}
						>
							<span className={styles.fileIcon}>
								{file.isDirectory ? "📁" : "📄"}
							</span>
							<span className={styles.fileName}>{file.name}</span>
							<span className={styles.filePath}>{file.path}</span>
						</button>
					))}
				</div>
			)}

			{/* Image previews */}
			{images.length > 0 && showImagePreview && (
				<div className={styles.imagePreviewBar}>
					{images.map((img) => (
						<div key={img.id} className={styles.imagePreviewItem}>
							<img src={img.preview} alt="Upload preview" />
							{img.isProcessingOCR && (
								<div className={styles.ocrIndicator}>OCR...</div>
							)}
							{img.ocrText && (
								<div className={styles.ocrBadge}>OCR</div>
							)}
							<button
								className={styles.removeImageBtn}
								onClick={() => removeImage(img.id)}
							>
								×
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

			{/* Toolbar */}
			<div className={styles.toolbar}>
				<button
					className={styles.toolbarBtn}
					onClick={() => onChange(value + "@")}
					title="@mention file"
					disabled={isStreaming}
				>
					@📎
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={handleFileUpload}
					title="Upload file/image"
					disabled={isStreaming}
				>
					📤
				</button>
			</div>

			{/* Input row */}
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
				<button
					className={`${styles.sendButton} ${isStreaming ? styles.stopButton : ""}`}
					onClick={handleSend}
					title={isStreaming ? "Stop" : "Send (Ctrl+Enter)"}
				>
					{isStreaming ? <StopIcon /> : <SendIcon />}
				</button>
			</div>
		</div>
	);
}

// Icons
function SendIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<line x1="22" y1="2" x2="11" y2="13" />
			<polygon points="22,2 15,22 11,13 2,9" />
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

function TerminalIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	);
}

function FileIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	);
}
