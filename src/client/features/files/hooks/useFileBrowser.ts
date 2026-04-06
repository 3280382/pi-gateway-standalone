/**
 * useFileBrowser - 文件浏览器核心逻辑 Hook
 * 
 * 职责：管理文件浏览器的业务逻辑
 * - 目录加载
 * - 错误处理
 * - 与 store 和 service 协调
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useFileStore } from "@/features/files/stores/fileStore";
import {
	loadDirectoryContent,
	getFriendlyErrorMessage,
} from "@/features/files/services/api/fileOperationsApi";
import { initializeFilePath } from "@/features/files/services/initialization.service";
import { fileBrowserDebug } from "@/lib/debug";

export interface UseFileBrowserResult {
	isInitializing: boolean;
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

	const [isInitializing, setIsInitializing] = useState(true);
	const lastLoadedPathRef = useRef<string>("");

	/**
	 * 初始化文件浏览器路径
	 */
	useEffect(() => {
		const init = async () => {
			const path = await initializeFilePath();
			setCurrentPath(path);
			setIsInitializing(false);
		};
		init();
	}, [setCurrentPath]);

	/**
	 * 加载目录内容
	 */
	const loadDirectory = useCallback(
		async (path: string) => {
			fileBrowserDebug.info("开始加载目录", { path });
			setLoading(true);
			setError(null);

			try {
				fileBrowserDebug.debug("调用 loadDirectoryContent", { path });
				const data = await loadDirectoryContent(path);

				fileBrowserDebug.info("目录加载成功", {
					currentPath: data.currentPath,
					itemCount: data.items.length,
					hasParent: data.parentPath !== data.currentPath,
				});

				setItems(data.items);
				setCurrentPath(data.currentPath);
				setParentPath(data.parentPath);

				lastLoadedPathRef.current = path;

				fileBrowserDebug.info("目录加载完成", {
					currentPath: data.currentPath,
					totalItems: data.items.length,
				});
			} catch (err) {
				const friendlyMessage = getFriendlyErrorMessage(err, path);
				fileBrowserDebug.error("目录加载失败", {
					path,
					error: friendlyMessage,
					errorObject: err,
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
		await loadDirectory(currentPath);
	}, [currentPath, loadDirectory]);

	/**
	 * 路径变化时自动加载
	 */
	useEffect(() => {
		if (currentPath === lastLoadedPathRef.current) {
			return;
		}

		fileBrowserDebug.info("路径变化，自动加载", { currentPath });
		loadDirectory(currentPath);
	}, [currentPath, loadDirectory]);

	return {
		isInitializing,
		loadDirectory,
		refresh,
	};
}
