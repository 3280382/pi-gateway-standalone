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
	const { currentPath, parentPath, setCurrentPath } = useFileStore();

	/**
	 * 导航到指定路径
	 */
	const navigateTo = useCallback(
		(path: string) => {
			if (path !== currentPath) {
				setCurrentPath(path);
			}
		},
		[currentPath, setCurrentPath],
	);

	/**
	 * 向上导航
	 */
	const navigateUp = useCallback(() => {
		if (currentPath === "/" || currentPath === "") return;

		const parent =
			parentPath || currentPath.split("/").slice(0, -1).join("/") || "/";
		if (parent !== currentPath) {
			setCurrentPath(parent);
		}
	}, [currentPath, parentPath, setCurrentPath]);

	/**
	 * 导航到主页
	 */
	const navigateHome = useCallback(() => {
		setCurrentPath("/root");
	}, [setCurrentPath]);

	/**
	 * 是否可以向上导航
	 */
	const canNavigateUp = currentPath !== "/" && currentPath !== "";

	return {
		navigateTo,
		navigateUp,
		navigateHome,
		canNavigateUp,
	};
}
