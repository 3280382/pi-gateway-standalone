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
	const itemsLengthRef = useRef<number>(0);
	const isInitialMount = useRef(true);

	useEffect(() => {
		// Git模式关闭时，清空所有文件的git状态
		if (!isGitModeActive) {
			// 只有当items有git状态时才清空
			const hasGitStatus = items.some(item => item.gitStatus);
			if (hasGitStatus) {
				updateFileGitStatuses({});
			}
			lastFetchedPathRef.current = ""; // 重置路径缓存
			itemsLengthRef.current = 0;
			isInitialMount.current = true;
			return;
		}

		// Git模式激活但无文件项，不执行操作
		if (items.length === 0) {
			return;
		}

		// 检查是否需要获取git状态
		const shouldFetchGitStatus = (
			// 路径变化
			workingDir !== lastFetchedPathRef.current ||
			// items长度变化（可能是新文件加载）
			items.length !== itemsLengthRef.current ||
			// 首次挂载且Git模式激活
			isInitialMount.current
		);

		if (!shouldFetchGitStatus) {
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
				itemsLengthRef.current = items.length;
				isInitialMount.current = false;
			} catch (error) {
				fileBrowserDebug.error("获取Git状态失败", { 
					workingDir, 
					error: error instanceof Error ? error.message : String(error) 
				});
				// 出错时清空状态
				updateFileGitStatuses({});
				lastFetchedPathRef.current = "";
				itemsLengthRef.current = 0;
			}
		};

		fetchGitStatus();
	}, [isGitModeActive, workingDir, items.length, updateFileGitStatuses]);
}