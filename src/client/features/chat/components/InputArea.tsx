/**
 * InputArea - Modern minimal design with session control
 *
 * 重构后：
 * - 所有业务逻辑移至 useInputArea hook
 * - 本组件只负责 UI 渲染
 */

import { useRef } from "react";
import { useInputArea } from "@/features/chat/hooks/useInputArea";
import { useModalStore } from "@/features/chat/stores/modalStore";
import styles from "./InputArea.module.css";

interface InputAreaProps {
	value: string;
	isStreaming: boolean;
	onChange: (text: string) => void;
	onSend: () => void;
	onAbort: () => void;
	onBashCommand?: (command: string) => void;
	onSlashCommand?: (command: string, args: string) => void;
	onSendWithImages?: (
		text: string,
		images: Array<{
			type: "image";
			source: { type: "base64"; mediaType: string; data: string };
		}>,
	) => void;
	onNewSession?: () => void;
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
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// 使用 useInputArea hook 处理所有业务逻辑
	const inputArea = useInputArea({
		value,
		isStreaming,
		onChange,
		onSend,
		onAbort,
		onBashCommand,
		onSlashCommand,
		onSendWithImages,
	});

	// 自动调整 textarea 高度
	const autoResizeTextarea = () => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			const newHeight = Math.max(textarea.scrollHeight, 64);
			textarea.style.height = `${Math.min(newHeight, 200)}px`;
		}
	};

	return (
		<div className={styles.container}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept="image/*,.txt,.md,.json,.js,.ts,.py,.sh,.java,.cpp,.c,.h,.go,.rs,.php,.rb,.swift,.kt,.html,.css,.scss,.yaml,.yml,.xml"
				className={styles.hiddenInput}
				onChange={(e) => {
					inputArea.imageUpload.addImages(e.target.files);
					e.target.value = "";
				}}
			/>

			{/* Slash Commands Menu */}
			{inputArea.slashCommands.isOpen && (
				<div className={styles.commandMenu}>
					{inputArea.slashCommands.filteredCommands.length > 0 ? (
						inputArea.slashCommands.filteredCommands.map((cmd, index) => (
							<button
								key={cmd.name}
								className={`${styles.commandItem} ${
									index === inputArea.slashCommands.selectedIndex
										? styles.selected
										: ""
								}`}
								onClick={() => inputArea.slashCommands.selectCurrent()}
								onMouseEnter={() =>
									inputArea.slashCommands.setSelectedIndex(index)
								}
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

			{/* File Picker */}
			{inputArea.filePicker.isOpen && (
				<div className={styles.filePicker}>
					<div className={styles.filePickerHeader}>
						<FileIcon />
						<span>Select file or directory</span>
					</div>
					{inputArea.filePicker.isLoading ? (
						<div className={styles.loadingItem}>Loading files...</div>
					) : inputArea.filePicker.filteredFiles.length > 0 ? (
						inputArea.filePicker.filteredFiles.map((file, index) => (
							<button
								key={file.path}
								className={`${styles.fileItem} ${
									index === inputArea.filePicker.selectedIndex
										? styles.selected
										: ""
								}`}
								onClick={() => inputArea.filePicker.selectCurrent()}
								onMouseEnter={() =>
									inputArea.filePicker.setSelectedIndex(index)
								}
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

			{/* Image Preview Bar */}
			{inputArea.imageUpload.images.length > 0 &&
				inputArea.imageUpload.showPreview && (
					<div className={styles.imagePreviewBar}>
						{inputArea.imageUpload.images.map((img) => (
							<div key={img.id} className={styles.imagePreviewItem}>
								<img src={img.preview} alt="Upload" />
								{img.isProcessingOCR && (
									<div className={styles.ocrIndicator}>⋯</div>
								)}
								{img.ocrText && <div className={styles.ocrBadge}>T</div>}
								<button
									className={styles.removeImageBtn}
									onClick={() => inputArea.imageUpload.removeImage(img.id)}
								>
									<CloseIcon />
								</button>
							</div>
						))}
						<button
							className={styles.togglePreviewBtn}
							onClick={() => inputArea.imageUpload.togglePreview()}
						>
							Hide
						</button>
					</div>
				)}
			{inputArea.imageUpload.images.length > 0 &&
				!inputArea.imageUpload.showPreview && (
					<div className={styles.imageCountBar}>
						<span>{inputArea.imageUpload.images.length} image(s)</span>
						<button onClick={() => inputArea.imageUpload.togglePreview()}>
							Show
						</button>
					</div>
				)}

			{/* Input Row */}
			<div className={styles.inputRow}>
				<textarea
					ref={textareaRef}
					className={`${styles.textarea} ${inputArea.isBashMode ? styles.bashMode : ""}`}
					placeholder={inputArea.placeholder}
					value={value}
					onChange={(e) => {
						inputArea.handleChange(e);
						// 使用 setTimeout 确保在状态更新后调整高度
						setTimeout(autoResizeTextarea, 0);
					}}
					onKeyDown={(e) => {
						inputArea.handleKeyDown(e);
						// 使用 setTimeout 确保在状态更新后调整高度
						setTimeout(autoResizeTextarea, 0);
					}}
					rows={2}
					disabled={isStreaming}
				/>
				<div className={styles.buttonColumn}>
					<button
						className={`${styles.sendButton} ${isStreaming ? styles.stopButton : ""}`}
						onClick={inputArea.handleSend}
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

			{/* Toolbar */}
			<div className={styles.toolbar}>
				<SystemPromptButton isStreaming={isStreaming} />
				<button
					className={styles.toolbarBtn}
					onClick={() => inputArea.filePicker.open()}
					title="Mention file (@)"
					disabled={isStreaming}
				>
					<span className={styles.btnIcon}>@</span>
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={() => inputArea.slashCommands.open()}
					title="Slash command (/)"
					disabled={isStreaming}
				>
					<span className={styles.btnIcon}>/</span>
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={() => inputArea.insertTextAtCursor("!", "bash")}
					title="Bash command (!)"
					disabled={isStreaming}
				>
					<span className={styles.btnIcon}>!</span>
				</button>
				<button
					className={styles.toolbarBtn}
					onClick={() => fileInputRef.current?.click()}
					title="Upload image/file"
					disabled={isStreaming}
				>
					<ImageIcon />
				</button>
			</div>
		</div>
	);
}

// Icons
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

// System Prompt Button Component
function SystemPromptButton({ isStreaming }: { isStreaming: boolean }) {
	const openSystemPrompt = useModalStore((state) => state.openSystemPrompt);

	return (
		<button
			className={styles.toolbarBtn}
			onClick={() => openSystemPrompt()}
			title="System Prompt"
			disabled={isStreaming}
		>
			<DocumentIcon />
		</button>
	);
}

function DocumentIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
		</svg>
	);
}
