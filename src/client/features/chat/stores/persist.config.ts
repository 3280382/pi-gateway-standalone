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
  CHAT_SESSION: 1,
  CHAT_SIDEBAR: 1,
} as const;

// ============================================================================
// Persist Fields
// ============================================================================

/** Chat Session Store - 持久化字段
 *
 * 注意：
 * - workingDir 已由全局 workspaceStore 管理
 * - currentSessionId 从服务器获取（init 响应）
 * - currentModel 从服务器获取（init 响应）
 * - availableModels 从服务器获取（list_models）
 * - thinkingLevel 从服务器获取（init 响应）
 * - currentSessionFile 需要持久化，用于RefreshPages面后恢复 session
 *
 * 只有 currentSessionFile 需要持久化，用于Pages面Refresh后精确恢复 session
 */
export const CHAT_SESSION_PERSIST: string[] = [
  "currentSessionFile", // 用于RefreshPages面后精确恢复 session
  "defaultMessageLimit", // 用户设置：默认加载历史消息Items数
] as const;

/** Chat Sidebar Store - 持久化字段
 *
 * 注意：
 * - sessions 从服务器获取（以当前工作directories为Arguments）
 * - selectedSessionId 从服务器获取（init 响应）
 * - workingDir 已由全局 workspaceStore 管理
 *
 * Chat Sidebar Store 不再持久化任何字段，所有数据从服务器获取
 */
export const CHAT_SIDEBAR_PERSIST: string[] = [
  // 所有数据都从服务器获取，不持久化到 localStorage
] as const;

/** Chat Store - 持久化字段
 *
 * 注意：
 * - searchQuery 和 searchFilters 保存用户的Search偏好
 */
export const CHAT_STORE_PERSIST: string[] = [
  "searchQuery",
  "searchFilters",
] as const;
