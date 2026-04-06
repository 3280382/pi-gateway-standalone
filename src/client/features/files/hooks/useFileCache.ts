/**
 * useFileCache - 文件路径缓存 Hook
 *
 * 职责：管理文件路径的缓存逻辑
 */

import { useCallback } from "react";
import { useFileStore } from "@/features/files/stores/fileStore";
import type { FileItem } from "@/features/files/stores/fileStore";

export interface UseFileCacheResult {
	getCachedItems: (path: string) => FileItem[] | null;
	setCachedItems: (path: string, items: FileItem[]) => void;
	clearCache: () => void;
	isCacheValid: (path: string) => boolean;
}

const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存有效期

export function useFileCache(): UseFileCacheResult {
	const { pathCache, setPathCache } = useFileStore();

	/**
	 * 获取缓存的目录项
	 */
	const getCachedItems = useCallback(
		(path: string): FileItem[] | null => {
			const cached = pathCache.get(path);
			if (!cached) return null;

			// 检查缓存是否过期
			if (Date.now() - cached.timestamp > CACHE_TTL) {
				// 清除过期缓存
				const newCache = new Map(pathCache);
				newCache.delete(path);
				setPathCache(newCache);
				return null;
			}

			return cached.items;
		},
		[pathCache, setPathCache],
	);

	/**
	 * 检查缓存是否有效
	 */
	const isCacheValid = useCallback(
		(path: string): boolean => {
			const cached = pathCache.get(path);
			if (!cached) return false;
			return Date.now() - cached.timestamp <= CACHE_TTL;
		},
		[pathCache],
	);

	/**
	 * 设置缓存的目录项
	 */
	const setCachedItems = useCallback(
		(path: string, items: FileItem[]) => {
			const newCache = new Map(pathCache);

			// 添加新缓存
			newCache.set(path, { items, timestamp: Date.now() });

			// 限制缓存大小（LRU策略）
			if (newCache.size > 50) {
				const firstKey = newCache.keys().next().value;
				newCache.delete(firstKey);
			}

			setPathCache(newCache);
		},
		[pathCache, setPathCache],
	);

	/**
	 * 清除所有缓存
	 */
	const clearCache = useCallback(() => {
		setPathCache(new Map());
	}, [setPathCache]);

	return {
		getCachedItems,
		setCachedItems,
		clearCache,
		isCacheValid,
	};
}
