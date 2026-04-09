/**
 * DirectoryPicker - 目录选择器组件
 *
 * 职责：
 * - 显示目录列表供用户选择
 * - 支持进入子目录和返回上级
 *
 * 结构规范：State → Ref → Effects → Computed → Actions → Render
 */

import { useEffect, useState } from "react";
import styles from "./AppHeader.module.css";

// ============================================================================
// Types
// ============================================================================

interface DirectoryEntry {
	name: string;
	path: string;
	isDirectory: boolean;
}

interface DirectoryPickerProps {
	currentPath: string;
	onSelect: (path: string) => void;
	onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DirectoryPicker({
	currentPath,
	onSelect,
	onClose,
}: DirectoryPickerProps) {
	// ========== 1. State ==========
	const [path, setPath] = useState(currentPath);
	const [entries, setEntries] = useState<DirectoryEntry[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	// ========== 4. Actions ==========
	const loadDirectory = async (dirPath: string) => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/browse", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: dirPath }),
			});
			const data = await response.json();

			const dirs = data.items
				.filter((item: any) => item.isDirectory)
				.map((item: any) => ({
					name: item.name,
					path: item.path,
					isDirectory: true,
				}));

			if (data.parentPath !== data.currentPath) {
				dirs.unshift({
					name: "..",
					path: data.parentPath,
					isDirectory: true,
				});
			}

			setEntries(dirs);
			setPath(data.currentPath);
		} catch (error) {
			console.error("[DirectoryPicker] Failed to load directory:", error);
			setEntries([]);
		} finally {
			setIsLoading(false);
		}
	};

	// ========== 3. Effects ==========
	useEffect(() => {
		loadDirectory(currentPath);
	}, [currentPath]);

	// ========== 6. Render ==========
	return (
		<div className={styles.pickerOverlay} onClick={onClose}>
			<div className={styles.picker} onClick={(e) => e.stopPropagation()}>
				<div className={styles.pickerHeader}>
					<h4>Select Working Directory</h4>
					<button className={styles.closeBtn} onClick={onClose}>
						✕
					</button>
				</div>
				<div className={styles.currentPath}>{path}</div>
				<div className={styles.pickerActions}>
					<button className={styles.selectBtn} onClick={() => onSelect(path)}>
						Select This Directory
					</button>
				</div>
				<div className={styles.entriesList}>
					{isLoading ? (
						<div className={styles.pickerLoading}>Loading...</div>
					) : (
						entries.map((entry) => (
							<div
								key={entry.path}
								className={styles.entry}
								onClick={() => loadDirectory(entry.path)}
							>
								<FolderIcon className={styles.entryIcon} />
								<span className={styles.entryName}>{entry.name}</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

function FolderIcon({ className }: { className?: string }) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
		</svg>
	);
}
