/**
 * Persist Config - 全局持久化配置
 *
 * 命名规范：
 * - 统一前缀：pi
 * - 层级结构：feature:store
 * - 示例：pi:chat:session, pi:files:browser
 *
 * 注意：
 * - Chat 和 Files 各自维护独立的 currentDir/currentPath
 * - 不持久化运行时状态（如 isLoading, error）
 */

// ============================================================================
// Storage Keys - 统一命名
// ============================================================================

export const STORAGE_KEYS = {
	// Chat Feature
	CHAT_SESSION: "pi:chat:session",
	CHAT_SIDEBAR: "pi:chat:sidebar",

	// Files Feature
	FILES_BROWSER: "pi:files:browser",
	FILES_WORKSPACE: "pi:files:workspace",

	// App Level
	APP_GLOBAL: "pi:app:global",
} as const;

// ============================================================================
// 版本号（用于数据迁移）
// ============================================================================

export const STORAGE_VERSION = {
	CHAT_SESSION: 1,
	CHAT_SIDEBAR: 1,
	FILES_BROWSER: 1,
	FILES_WORKSPACE: 1,
	APP_GLOBAL: 1,
} as const;

// ============================================================================
// Partialize 配置 - 明确哪些字段需要持久化
// ============================================================================

/** Chat Session Store - 持久化字段 */
export const CHAT_SESSION_PERSIST = [
	"currentSessionId",
	"workingDir", // Chat 独立的当前工作目录
	"currentModel",
	"thinkingLevel",
	"theme",
	"fontSize",
] as const;

/** Chat Sidebar Store - 持久化字段 */
export const CHAT_SIDEBAR_PERSIST = ["lastSessionByDir"] as const;

/** Files Browser Store - 持久化字段 */
export const FILES_BROWSER_PERSIST = [
	"workingDir", // Files 独立的当前工作目录
	"viewMode",
	"sortMode",
	"filterType",
	"isSidebarVisible",
	"bottomPanelHeight",
] as const;

/** Files Workspace Store - 持久化字段 */
export const FILES_WORKSPACE_PERSIST = ["recentWorkspaces"] as const;

/** App Global Store - 持久化字段 */
export const APP_GLOBAL_PERSIST = ["currentView", "theme", "fontSize"] as const;

// ============================================================================
// 调试工具
// ============================================================================

/** 打印所有持久化状态（开发环境使用） */
export function inspectPersistedState(): void {
	if (process.env.NODE_ENV !== "development") return;

	console.group("🔍 Persisted State in localStorage");

	Object.values(STORAGE_KEYS).forEach((key) => {
		const data = localStorage.getItem(key);
		if (data) {
			try {
				const parsed = JSON.parse(data);
				console.log(`\n${key}:`, {
					version: parsed.version,
					state: parsed.state,
				});
			} catch {
				console.log(`${key}: [Invalid JSON]`);
			}
		} else {
			console.log(`${key}: [Empty]`);
		}
	});

	console.groupEnd();
}

/** 清空所有持久化状态 */
export function clearPersistedState(): void {
	Object.values(STORAGE_KEYS).forEach((key) => {
		localStorage.removeItem(key);
	});
	console.log("[Persist] All states cleared");
}

/** 暴露到 window 供调试（开发环境） */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
	(window as any).__PI_PERSIST = {
		inspect: inspectPersistedState,
		clear: clearPersistedState,
		keys: STORAGE_KEYS,
	};
}
