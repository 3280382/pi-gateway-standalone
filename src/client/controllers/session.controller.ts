/**
 * Session Controller - 连接Service层和Store层
 * 处理会话和用户设置相关的业务逻辑
 */

import type { BackupInfo, SessionStats, UserSettings, WorkspaceInfo } from "@/services/session.service";
import { sessionService } from "@/services/session.service";
import { fileController } from "./file.controller";

export class SessionController {
	private settings: UserSettings | null = null;
	private currentWorkspace: WorkspaceInfo | null = null;
	private recentWorkspaces: WorkspaceInfo[] = [];

	/**
	 * 获取用户设置
	 */
	async getUserSettings(): Promise<UserSettings> {
		try {
			if (this.settings) {
				return this.settings;
			}

			console.log("[SessionController] Loading user settings");
			this.settings = await sessionService.getUserSettings();
			return this.settings;
		} catch (error) {
			this.handleError("getUserSettings", error);
			throw error;
		}
	}

	/**
	 * 更新用户设置
	 */
	async updateUserSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
		try {
			console.log("[SessionController] Updating user settings:", updates);

			// 合并更新
			const currentSettings = await this.getUserSettings();
			const newSettings = { ...currentSettings, ...updates };

			// 保存到服务
			this.settings = await sessionService.updateUserSettings(newSettings);

			// 应用设置变更
			this.applySettingsChanges(updates);

			return this.settings;
		} catch (error) {
			this.handleError("updateUserSettings", error);
			throw error;
		}
	}

	/**
	 * 重置用户设置
	 */
	async resetUserSettings(): Promise<UserSettings> {
		try {
			console.log("[SessionController] Resetting user settings");
			this.settings = await sessionService.resetUserSettings();

			// 应用重置后的设置
			this.applySettingsChanges(this.settings);

			return this.settings;
		} catch (error) {
			this.handleError("resetUserSettings", error);
			throw error;
		}
	}

	/**
	 * 获取当前工作空间
	 */
	async getCurrentWorkspace(): Promise<WorkspaceInfo> {
		try {
			if (this.currentWorkspace) {
				return this.currentWorkspace;
			}

			console.log("[SessionController] Loading current workspace");
			this.currentWorkspace = await sessionService.getCurrentWorkspace();
			return this.currentWorkspace;
		} catch (error) {
			this.handleError("getCurrentWorkspace", error);
			throw error;
		}
	}

	/**
	 * 切换工作空间
	 */
	async switchWorkspace(path: string): Promise<WorkspaceInfo> {
		try {
			console.log(`[SessionController] Switching workspace to: ${path}`);

			// 切换工作空间
			this.currentWorkspace = await sessionService.switchWorkspace(path);

			// 添加到最近列表
			await this.addToRecentWorkspaces(path);

			// 更新文件控制器的当前路径
			fileController.setCurrentPath(path);

			return this.currentWorkspace;
		} catch (error) {
			this.handleError("switchWorkspace", error);
			throw error;
		}
	}

	/**
	 * 获取最近的工作空间列表
	 */
	async getRecentWorkspaces(limit: number = 10): Promise<WorkspaceInfo[]> {
		try {
			if (this.recentWorkspaces.length > 0) {
				return this.recentWorkspaces.slice(0, limit);
			}

			console.log(`[SessionController] Loading recent workspaces (limit: ${limit})`);
			this.recentWorkspaces = await sessionService.getRecentWorkspaces(limit);
			return this.recentWorkspaces;
		} catch (error) {
			this.handleError("getRecentWorkspaces", error);
			throw error;
		}
	}

	/**
	 * 添加工件空间到最近列表
	 */
	async addToRecentWorkspaces(path: string): Promise<void> {
		try {
			console.log(`[SessionController] Adding to recent workspaces: ${path}`);
			await sessionService.addToRecentWorkspaces(path);

			// 更新本地缓存
			const workspaces = await this.getRecentWorkspaces();

			// 如果已存在，先移除
			const filtered = workspaces.filter((w) => w.path !== path);

			// 添加新的工作空间信息
			const workspaceInfo: WorkspaceInfo = {
				path,
				name: path.split("/").pop() || path,
				isCurrent: true,
				sessionCount: 0,
				lastAccessed: new Date().toISOString(),
			};

			this.recentWorkspaces = [workspaceInfo, ...filtered].slice(0, 10);
		} catch (error) {
			this.handleError("addToRecentWorkspaces", error);
			// 不抛出错误，因为这只是优化功能
			console.warn("Failed to add workspace to recent list:", error);
		}
	}

	/**
	 * 从最近列表移除工作空间
	 */
	async removeFromRecentWorkspaces(path: string): Promise<void> {
		try {
			console.log(`[SessionController] Removing from recent workspaces: ${path}`);
			await sessionService.removeFromRecentWorkspaces(path);

			// 更新本地缓存
			this.recentWorkspaces = this.recentWorkspaces.filter((w) => w.path !== path);
		} catch (error) {
			this.handleError("removeFromRecentWorkspaces", error);
			throw error;
		}
	}

	/**
	 * 获取会话统计信息
	 */
	async getSessionStats(): Promise<SessionStats> {
		try {
			console.log("[SessionController] Getting session stats");
			return await sessionService.getSessionStats();
		} catch (error) {
			this.handleError("getSessionStats", error);
			throw error;
		}
	}

	/**
	 * 导出会话数据
	 */
	async exportSessions(sessionIds: string[], format: "json" | "markdown" | "html" = "json"): Promise<void> {
		try {
			console.log(`[SessionController] Exporting ${sessionIds.length} sessions as ${format}`);
			const blob = await sessionService.exportSessions(sessionIds, format);

			// 创建下载链接
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `sessions-export-${new Date().toISOString().split("T")[0]}.${format}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			this.handleError("exportSessions", error);
			throw error;
		}
	}

	/**
	 * 导入会话数据
	 */
	async importSessions(file: File): Promise<{ imported: number; failed: number }> {
		try {
			console.log("[SessionController] Importing sessions from file:", file.name);
			const result = await sessionService.importSessions(file);

			console.log(`[SessionController] Import result: ${result.imported} imported, ${result.failed} failed`);
			return result;
		} catch (error) {
			this.handleError("importSessions", error);
			throw error;
		}
	}

	/**
	 * 创建备份
	 */
	async createBackup(description?: string): Promise<BackupInfo> {
		try {
			console.log("[SessionController] Creating backup", description ? `(${description})` : "");
			const backup = await sessionService.createBackup(description);

			console.log(`[SessionController] Backup created: ${backup.id} (${backup.size} bytes)`);
			return backup;
		} catch (error) {
			this.handleError("createBackup", error);
			throw error;
		}
	}

	/**
	 * 获取备份列表
	 */
	async getBackups(): Promise<BackupInfo[]> {
		try {
			console.log("[SessionController] Getting backup list");
			return await sessionService.getBackups();
		} catch (error) {
			this.handleError("getBackups", error);
			throw error;
		}
	}

	/**
	 * 恢复备份
	 */
	async restoreBackup(backupId: string): Promise<void> {
		try {
			console.log(`[SessionController] Restoring backup: ${backupId}`);
			await sessionService.restoreBackup(backupId);

			// 重置本地缓存
			this.settings = null;
			this.currentWorkspace = null;
			this.recentWorkspaces = [];

			console.log("[SessionController] Backup restored successfully");
		} catch (error) {
			this.handleError("restoreBackup", error);
			throw error;
		}
	}

	/**
	 * 删除备份
	 */
	async deleteBackup(backupId: string): Promise<void> {
		try {
			console.log(`[SessionController] Deleting backup: ${backupId}`);
			await sessionService.deleteBackup(backupId);
		} catch (error) {
			this.handleError("deleteBackup", error);
			throw error;
		}
	}

	/**
	 * 获取系统信息
	 */
	async getSystemInfo(): Promise<any> {
		try {
			console.log("[SessionController] Getting system info");
			return await sessionService.getSystemInfo();
		} catch (error) {
			this.handleError("getSystemInfo", error);
			throw error;
		}
	}

	/**
	 * 获取性能指标
	 */
	async getPerformanceMetrics(): Promise<any> {
		try {
			console.log("[SessionController] Getting performance metrics");
			return await sessionService.getPerformanceMetrics();
		} catch (error) {
			this.handleError("getPerformanceMetrics", error);
			throw error;
		}
	}

	/**
	 * 清理临时文件
	 */
	async cleanupTempFiles(): Promise<{ deleted: number; freed: number; errors: number }> {
		try {
			console.log("[SessionController] Cleaning up temp files");
			const result = await sessionService.cleanupTempFiles();

			console.log(
				`[SessionController] Cleanup result: ${result.deleted} files deleted, ${result.freed} bytes freed, ${result.errors} errors`,
			);
			return result;
		} catch (error) {
			this.handleError("cleanupTempFiles", error);
			throw error;
		}
	}

	/**
	 * 重置应用状态
	 */
	async resetAppState(): Promise<void> {
		try {
			console.log("[SessionController] Resetting app state");
			await sessionService.resetAppState();

			// 重置本地缓存
			this.settings = null;
			this.currentWorkspace = null;
			this.recentWorkspaces = [];

			// 重置其他控制器
			// chatController.reset(); // 假设有reset方法
			fileController.clearCache();
		} catch (error) {
			this.handleError("resetAppState", error);
			throw error;
		}
	}

	/**
	 * 应用设置变更
	 */
	private applySettingsChanges(updates: Partial<UserSettings>): void {
		// 应用主题变更
		if (updates.theme !== undefined) {
			this.applyTheme(updates.theme);
		}

		// 应用字体大小变更
		if (updates.fontSize !== undefined) {
			this.applyFontSize(updates.fontSize);
		}

		// 应用语言变更
		if (updates.language !== undefined) {
			this.applyLanguage(updates.language);
		}

		// 这里可以添加其他设置的应用逻辑
	}

	/**
	 * 应用主题
	 */
	private applyTheme(theme: "light" | "dark" | "auto"): void {
		console.log(`[SessionController] Applying theme: ${theme}`);

		// 移除现有主题类
		document.body.classList.remove("light-mode", "dark-mode");

		if (theme === "auto") {
			// 使用系统偏好
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			document.body.classList.add(prefersDark ? "dark-mode" : "light-mode");
		} else {
			document.body.classList.add(`${theme}-mode`);
		}
	}

	/**
	 * 应用字体大小
	 */
	private applyFontSize(fontSize: "tiny" | "small" | "medium" | "large"): void {
		console.log(`[SessionController] Applying font size: ${fontSize}`);

		// 移除现有字体大小类
		document.body.classList.remove("font-tiny", "font-small", "font-medium", "font-large");

		// 添加新的字体大小类
		document.body.classList.add(`font-${fontSize}`);
	}

	/**
	 * 应用语言
	 */
	private applyLanguage(language: string): void {
		console.log(`[SessionController] Applying language: ${language}`);

		// 设置HTML lang属性
		document.documentElement.lang = language;

		// 这里可以添加更多的语言应用逻辑
		// 例如：加载翻译文件、更新界面文本等
	}

	/**
	 * 处理错误
	 */
	private handleError(method: string, error: any): void {
		console.error(`[SessionController.${method}] Error:`, error);

		// 这里可以添加更详细的错误处理逻辑
		// 例如：显示错误通知、记录错误日志等
	}
}

// 导出单例
export const sessionController = new SessionController();
