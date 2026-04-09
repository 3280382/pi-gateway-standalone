/**
 * useFileNavigation - 文件导航逻辑 Hook
 *
 * 职责：管理文件浏览器的导航逻辑
 */

import { useCallback } from "react";
import { useFileStore } from "@/features/files/stores/fileStore";

export interface UseFileNavigationResult {
	navigateTo: (path: string) => void;
	navigateUp: () => void;
	navigateHome: () => void;
	canNavigateUp: boolean;
}

export function useFileNavigation(): UseFileNavigationResult {
	const { workingDir, parentPath, setWorkingDir } = useFileStore();

	/**
	 * 导航到指定路径
	 */
	const navigateTo = useCallback(
		(path: string) => {
			if (path !== workingDir) {
				setWorkingDir(path);
			}
		},
		[workingDir, setWorkingDir],
	);

	/**
	 * 向上导航
	 */
	const navigateUp = useCallback(() => {
		if (workingDir === "/" || workingDir === "") return;

		const parent =
			parentPath || workingDir.split("/").slice(0, -1).join("/") || "/";
		if (parent !== workingDir) {
			setWorkingDir(parent);
		}
	}, [workingDir, parentPath, setWorkingDir]);

	/**
	 * 导航到主页
	 */
	const navigateHome = useCallback(() => {
		setWorkingDir("/root");
	}, [setWorkingDir]);

	/**
	 * 是否可以向上导航
	 */
	const canNavigateUp = workingDir !== "/" && workingDir !== "";

	return {
		navigateTo,
		navigateUp,
		navigateHome,
		canNavigateUp,
	};
}
