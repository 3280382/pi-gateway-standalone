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
 * 注意：
 * - 当前工作目录由全局 workspaceStore (pi:app:workspace) 统一管理，不重复存储
 * - workspaceSessionFiles: 每个 workspace 对应的 sessionFile，切换时自动恢复
 * - defaultMessageLimit: 用户设置
 */
export const CHAT_SESSION_PERSIST: string[] = [
  "workspaceSessionFiles", // workspace → sessionFile 映射
  "defaultMessageLimit", // 用户设置：默认加载历史消息Items数
] as const;

/** Chat Sidebar Store - 持久化字段
 *
 * 注意：
 * - sessions 从服务器获取（以当前工作directories为Arguments）
 * - selectedSessionId 从服务器获取（init 响应）
 * - workingDir 已由全局 workspaceStore 管理
 * - recentWorkspaces 需要持久化，刷新后快速重建最近工作目录
 */
export const CHAT_SIDEBAR_PERSIST: string[] = [
  "recentWorkspaces", // 最近工作directories（最多3个），刷新后快速切换
] as const;

/** Chat Store - 持久化字段
 *
 * 注意：
 * - searchQuery 和 searchFilters 保存用户的Search偏好
 */
export const CHAT_STORE_PERSIST: string[] = ["searchQuery", "searchFilters"] as const;
