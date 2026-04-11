/**
 * useGitStatus - Git状态管理Hook
 *
 * 职责：管理文件项的Git状态显示
 * - 当Git模式激活时，获取当前目录文件的Git状态
 * - 将Git状态映射到store中的文件项
 * - 处理路径映射（相对路径 vs 绝对路径）
 */

import { useEffect, useRef } from "react";
import { getGitStatus } from "@/features/files/services/gitApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { fileBrowserDebug } from "@/lib/debug";

export function useGitStatus() {
	const { isGitModeActive, workingDir, items, updateFileGitStatuses } = useFileStore();
	const lastFetchedPathRef = useRef<string>("");

	useEffect(() => {
		// 只有当Git模式激活且有文件项时才获取状态
		if (!isGitModeActive || items.length === 0) {
			// 如果Git模式关闭，清空所有文件的git状态
			if (!isGitModeActive && items.length > 0) {
				updateFileGitStatuses({});
			}
			return;
		}

		// 防止重复获取相同路径的状态
		if (workingDir === lastFetchedPathRef.current) {
			return;
		}

		const fetchGitStatus = async () => {
			fileBrowserDebug.debug("开始获取Git状态", { workingDir });
			
			try {
				const statuses = await getGitStatus(workingDir);
				fileBrowserDebug.debug("获取到Git状态", { 
					workingDir, 
					statusCount: Object.keys(statuses).length 
				});
				
				// 将状态映射转换为与文件项路径匹配的格式
				const itemStatusMap: Record<string, string> = {};
				
				// 遍历所有文件项，查找匹配的git状态
				for (const item of items) {
					// 跳过父目录项 ".."
					if (item.name === "..") continue;
					
					// 尝试多种匹配方式
					let matchedStatus: string | undefined;
					
					// 1. 尝试完整路径匹配（相对路径）
					// 计算相对于workingDir的路径
					let relativePath = item.path;
					if (item.path.startsWith(workingDir)) {
						relativePath = item.path.substring(workingDir.length);
						// 去除开头的斜杠
						if (relativePath.startsWith("/")) {
							relativePath = relativePath.substring(1);
						}
					}
					
					// 检查相对路径是否匹配
					if (relativePath && statuses[relativePath]) {
						matchedStatus = statuses[relativePath];
					} 
					// 2. 尝试文件名匹配
					else if (statuses[item.name]) {
						matchedStatus = statuses[item.name];
					}
					// 3. 尝试路径后缀匹配（对于嵌套目录）
					else {
						// 查找任何以相对路径结尾的状态键
						for (const [statusPath, status] of Object.entries(statuses)) {
							if (statusPath.endsWith(`/${relativePath}`) || statusPath === relativePath) {
								matchedStatus = status;
								break;
							}
						}
					}
					
					if (matchedStatus) {
						itemStatusMap[item.path] = matchedStatus;
					}
				}
				
				// 更新store中的文件项git状态
				updateFileGitStatuses(itemStatusMap);
				lastFetchedPathRef.current = workingDir;
			} catch (error) {
				fileBrowserDebug.error("获取Git状态失败", { 
					workingDir, 
					error: error instanceof Error ? error.message : String(error) 
				});
				// 出错时清空状态
				updateFileGitStatuses({});
			}
		};

		fetchGitStatus();
	}, [isGitModeActive, workingDir, items, updateFileGitStatuses]);

	// 当items变化时，如果Git模式激活，重新获取状态
	useEffect(() => {
		if (!isGitModeActive || items.length === 0) {
			return;
		}

		// 如果路径没有变化，但items变化了（比如刷新），重新获取状态
		const fetchGitStatus = async () => {
			try {
				const statuses = await getGitStatus(workingDir);
				
				// 将状态映射转换为与文件项路径匹配的格式
				const itemStatusMap: Record<string, string> = {};
				
				// 遍历所有文件项，查找匹配的git状态
				for (const item of items) {
					// 跳过父目录项 ".."
					if (item.name === "..") continue;
					
					// 尝试多种匹配方式
					let matchedStatus: string | undefined;
					
					// 1. 尝试完整路径匹配（相对路径）
					// 计算相对于workingDir的路径
					let relativePath = item.path;
					if (item.path.startsWith(workingDir)) {
						relativePath = item.path.substring(workingDir.length);
						// 去除开头的斜杠
						if (relativePath.startsWith("/")) {
							relativePath = relativePath.substring(1);
						}
					}
					
					// 检查相对路径是否匹配
					if (relativePath && statuses[relativePath]) {
						matchedStatus = statuses[relativePath];
					} 
					// 2. 尝试文件名匹配
					else if (statuses[item.name]) {
						matchedStatus = statuses[item.name];
					}
					// 3. 尝试路径后缀匹配（对于嵌套目录）
					else {
						// 查找任何以相对路径结尾的状态键
						for (const [statusPath, status] of Object.entries(statuses)) {
							if (statusPath.endsWith(`/${relativePath}`) || statusPath === relativePath) {
								matchedStatus = status;
								break;
							}
						}
					}
					
					if (matchedStatus) {
						itemStatusMap[item.path] = matchedStatus;
					}
				}
				
				updateFileGitStatuses(itemStatusMap);
			} catch (error) {
				updateFileGitStatuses({});
			}
		};

		// 使用防抖，避免频繁调用
		const timeoutId = setTimeout(fetchGitStatus, 300);
		return () => clearTimeout(timeoutId);
	}, [isGitModeActive, workingDir, items, updateFileGitStatuses]);
}