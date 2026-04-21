/**
 * Persist Config - Chat Feature
 *
 * Chat 功能相关的Persistence config
 *
 * 架构原则：
 * - LocalStorage 只保留当前工作directories（由全局 workspaceStore 管理）
 * - 其他所有数据（sessions、currentSession、models、currentModel）都从服务器获取
 * - 工作directories初始化时（init），服务器返回所有相关Arguments
 */

// ============================================================================
// Storage Keys
// ============================================================================

export const CHAT_STORAGE_KEYS = {
  CHAT_SESSION: "pi:chat:session",
  CHAT_SIDEBAR: "pi:chat:sidebar",
  CHAT_STORE: "pi:chat:store",
} as const;

// ============================================================================
// Storage Versions
// ============================================================================

export const CHAT_STORAGE_VERSION = {
  CHAT_SESSION: 3, // version 3: per-workspace session file persistence
  CHAT_SIDEBAR: 2, // version 2: add recentWorkspaces persistence
} as const;

// ============================================================================
// Persist Fields
// ============================================================================

/** Chat Session Store - 持久化字段
 *
 * 注意：所有 workspace 相关持久化字段已统一到全局 workspaceStore (pi:app:workspace)
 * - sessionFiles -> workspaceStore.sessionFiles
 * - defaultMessageLimit -> workspaceStore.defaultMessageLimit
 * - workingDir -> workspaceStore.currentPath
 */
export const CHAT_SESSION_PERSIST: string[] = [] as const;

/** Chat Sidebar Store - 持久化字段
 *
 * 注意：所有 workspace 相关持久化字段已统一到全局 workspaceStore (pi:app:workspace)
 * - recentWorkspaces -> workspaceStore.recentWorkspaces
 * - workingDir -> workspaceStore.currentPath
 */
export const CHAT_SIDEBAR_PERSIST: string[] = [] as const;

/** Chat Store - 持久化字段
 *
 * 注意：
 * - searchQuery 和 searchFilters 保存用户的Search偏好
 */
export const CHAT_STORE_PERSIST: string[] = ["searchQuery", "searchFilters"] as const;
