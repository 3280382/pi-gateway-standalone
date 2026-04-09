/**
 * WorkingDirectory Section
 * 使用系统API获取和设置工作目录
 */

import { useEffect, useState } from "react";
import { SectionHeader } from "@/features/chat/components/SectionHeader/SectionHeader";
import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import styles from "./WorkingDirectory.module.css";

export function WorkingDirectory() {
	// ========== 1. State ==========
	const workingDir = useSidebarStore((state) => state.workingDir);
	const isLoading = useSidebarStore((state) => state.isLoading);
	const controller = useSidebarController();
	const [isPickerVisible, setIsPickerVisible] = useState(false);
	
	// ========== 2. Ref ==========
	// 暂无
	
	// ========== 3. Effects ==========
	// 暂无
	
	// ========== 4. Computed ==========
	// 暂无
	
	// ========== 5. Actions ==========

	// 点击工作目录打开选择器
	const handleClick = () => {
		setIsPickerVisible(true);
	};

	// 处理目录选择
	const handleSelect = async (path: string) => {
		setIsPickerVisible(false);
		if (path && path !== workingDir?.path) {
			await controller.changeWorkingDir(path);
		}
	};
	
	// ========== 6. Render ==========

	return (
		<section className={styles.section}>
			<SectionHeader title="Working Directory" />
			<div
				className={`${styles.directory} ${isLoading ? styles.loading : ""}`}
				onClick={handleClick}
				title="Click to change working directory"
			>
				<FolderIcon className={styles.icon} />
				<span className={styles.path}>
					{isLoading
						? "Loading..."
						: workingDir?.displayName || workingDir?.path || "~"}
				</span>
			</div>

			{/* Directory Picker Modal */}
			{isPickerVisible && (
				<DirectoryPicker
					currentPath={workingDir?.path || "/root"}
					onSelect={handleSelect}
					onClose={() => setIsPickerVisible(false)}
				/>
			)}
		</section>
	);
}

// 目录选择器组件
function DirectoryPicker({
	currentPath,
	onSelect,
	onClose,
}: {
	currentPath: string;
	onSelect: (path: string) => void;
	onClose: () => void;
}) {
	const [path, setPath] = useState(currentPath);
	const [entries, setEntries] = useState<
		Array<{ name: string; path: string; isDirectory: boolean }>
	>([]);
	const [loading, setLoading] = useState(false);

	// 加载目录内容
	const loadDirectory = async (dirPath: string) => {
		setLoading(true);
		try {
			const response = await fetch("/api/browse", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: dirPath }),
			});
			const data = await response.json();

			// 过滤只显示目录
			const dirs = data.items
				.filter((item: any) => item.isDirectory)
				.map((item: any) => ({
					name: item.name,
					path: item.path,
					isDirectory: true,
				}));

			// 添加上级目录
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
			console.error("Failed to load directory:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadDirectory(currentPath);
	}, [currentPath]);

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
					{loading ? (
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
