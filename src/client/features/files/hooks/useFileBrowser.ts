/**
 * useFileBrowser - 文件浏览器核心逻辑 Hook
 *
 * 职责：管理文件浏览器的业务逻辑
 * - 目录加载
 * - 错误处理
 * - 与 store 和 service 协调
 */

import { useCallback, useEffect, useRef } from "react";
import {
	getFriendlyErrorMessage,
	loadDirectoryContent,
} from "@/features/files/services/api/fileOperationsApi";
import { initializeFilePath } from "@/features/files/services/initialization";
import { useFileStore } from "@/features/files/stores/fileStore";
import { fileBrowserDebug } from "@/lib/debug";

export interface UseFileBrowserResult {
	loadDirectory: (path: string) => Promise<void>;
	refresh: () => Promise<void>;
}

export function useFileBrowser(): UseFileBrowserResult {
	const {
		currentPath,
		setItems,
		setCurrentPath,
		setParentPath,
		setLoading,
		setError,
	} = useFileStore();

	const lastLoadedPathRef = useRef<string>("");

	/**
	 * 初始化文件浏览器路径（只运行一次）
	 */
	useEffect(() => {
		const init = async () => {
			const path = await initializeFilePath();
			setCurrentPath(path);
		};
		init();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * 加载目录内容
	 */
	const loadDirectory = useCallback(
		async (path: string) => {
			// 防止重复加载相同路径
			if (path === lastLoadedPathRef.current) {
				return;
			}

			fileBrowserDebug.debug("开始加载目录", { path });
			setLoading(true);
			setError(null);

			try {
				const data = await loadDirectoryContent(path);

				// 先标记已加载，避免状态更新后重复加载
				lastLoadedPathRef.current = path;

				setItems(data.items);
				setCurrentPath(data.currentPath);
				setParentPath(data.parentPath);
			} catch (err) {
				const friendlyMessage = getFriendlyErrorMessage(err, path);
				fileBrowserDebug.error("目录加载失败", {
					path,
					error: friendlyMessage,
				});
				setError(friendlyMessage);
			} finally {
				setLoading(false);
			}
		},
		[setItems, setCurrentPath, setParentPath, setLoading, setError],
	);

	/**
	 * 刷新当前目录
	 */
	const refresh = useCallback(async () => {
		lastLoadedPathRef.current = "";
		await loadDirectory(currentPath);
	}, [currentPath, loadDirectory]);

	/**
	 * 路径变化时自动加载
	 */
	useEffect(() => {
		if (currentPath === lastLoadedPathRef.current) {
			return;
		}

		fileBrowserDebug.debug("路径变化，自动加载", { currentPath });
		loadDirectory(currentPath);
	}, [currentPath, loadDirectory]);

	return {
		loadDirectory,
		refresh,
	};
}
