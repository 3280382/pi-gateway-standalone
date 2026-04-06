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
import { initializeFilePath } from "@/features/files/services/initialization";
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
	const isLoadingRef = useRef(false);

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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // 只在挂载时运行一次

	/**
	 * 加载目录内容
	 */
	const loadDirectory = useCallback(
		async (path: string) => {
			// 防止重复加载（已在加载中或已加载相同路径）
			if (isLoadingRef.current || path === lastLoadedPathRef.current) {
				return;
			}

			isLoadingRef.current = true;
			fileBrowserDebug.debug("开始加载目录", { path });
			setLoading(true);
			setError(null);

			try {
				fileBrowserDebug.debug("调用 loadDirectoryContent", { path });
				const data = await loadDirectoryContent(path);

				fileBrowserDebug.debug("目录加载成功", {
					currentPath: data.currentPath,
					itemCount: data.items.length,
				});

				// 先标记已加载，避免状态更新触发重渲染后重复加载
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
				isLoadingRef.current = false;
			}
		},
		[setItems, setCurrentPath, setParentPath, setLoading, setError],
	);

	/**
	 * 刷新当前目录
	 */
	const refresh = useCallback(async () => {
		// 清除已加载标记，强制重新加载
		lastLoadedPathRef.current = "";
		await loadDirectory(currentPath);
	}, [currentPath, loadDirectory]);

	/**
	 * 路径变化时自动加载
	 */
	useEffect(() => {
		// 只在初始化完成后，且路径真正变化时才加载
		if (isInitializing) {
			return;
		}

		if (currentPath === lastLoadedPathRef.current) {
			return;
		}

		fileBrowserDebug.debug("路径变化，自动加载", { currentPath });
		loadDirectory(currentPath);
	}, [currentPath, loadDirectory, isInitializing]);

	return {
		isInitializing,
		loadDirectory,
		refresh,
	};
}
