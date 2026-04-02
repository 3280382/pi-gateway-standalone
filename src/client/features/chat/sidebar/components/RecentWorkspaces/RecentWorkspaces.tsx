/**
 * RecentWorkspaces Section
 * 使用 Zustand persist 存储（自动保存到 localStorage）
 */

import { useSidebarController } from "@/features/chat/services/api/sidebarApi";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import { IconButton } from "@/shared/ui/IconButton/IconButton";
import { SectionHeader } from "@/shared/ui/SectionHeader/SectionHeader";
import styles from "./RecentWorkspaces.module.css";

export function RecentWorkspaces() {
	const recentWorkspaces = useSidebarStore((state) => state.recentWorkspaces);
	const workingDir = useSidebarStore((state) => state.workingDir);
	const isLoading = useSidebarStore((state) => state.isLoading);
	const controller = useSidebarController();
	const setRecentWorkspaces = useSidebarStore(
		(state) => state.setRecentWorkspaces,
	);

	// 获取当前工作目录路径用于高亮
	const currentPath = workingDir?.path || "";

	// 调试信息

	const handleClear = () => {
		setRecentWorkspaces([]);
	};

	const handleSelect = (path: string) => {
		controller.changeWorkingDir(path);
	};

	if (isLoading && recentWorkspaces.length === 0) {
		return (
			<section className={styles.section}>
				<SectionHeader title="Recent Workspaces" />
				<div className={styles.loading}>Loading...</div>
			</section>
		);
	}

	if (recentWorkspaces.length === 0) {
		return (
			<section className={styles.section}>
				<SectionHeader title="Recent Workspaces" />
				<div className={styles.empty}>No recent workspaces</div>
			</section>
		);
	}

	return (
		<section className={styles.section}>
			<SectionHeader
				title="Recent Workspaces"
				action={
					<IconButton onClick={handleClear} title="Clear Recent">
						<TrashIcon />
					</IconButton>
				}
			/>
			<div className={styles.list}>
				{recentWorkspaces.map((workspace) => {
					// Normalize path (handle both string and object formats)
					const rawPath =
						typeof workspace === "string" ? workspace : workspace?.path || "";
					const path = rawPath.replace(/\/$/, ""); // Remove trailing slash
					const name = path.split("/").pop() || path;

					const isActive = currentPath === path || currentPath === rawPath;

					return (
						<button
							key={path}
							className={`${styles.item} ${isActive ? styles.active : ""}`}
							onClick={() => handleSelect(path)}
							title={path}
						>
							<FolderIcon />
							<div className={styles.info}>
								<span className={styles.name}>{name}</span>
								<span className={styles.path}>{path}</span>
							</div>
						</button>
					);
				})}
			</div>
		</section>
	);
}

function TrashIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	);
}

function FolderIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
		</svg>
	);
}
