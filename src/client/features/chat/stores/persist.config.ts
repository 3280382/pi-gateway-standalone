/**
 * Persist Config - Chat Feature
 *
 * Chat 功能相关的持久化配置
 * 
 * 架构原则：
 * - LocalStorage 只保留当前工作目录（由全局 workspaceStore 管理）
 * - 其他所有数据（sessions、currentSession、models、currentModel）都从服务器获取
 * - 工作目录初始化时（init），服务器返回所有相关参数
 */

// ============================================================================
// Storage Keys
// ============================================================================

export const CHAT_STORAGE_KEYS = {
  CHAT_SESSION: "pi:chat:session",
  CHAT_SIDEBAR: "pi:chat:sidebar",
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
 * 
 * Chat Session Store 不再持久化任何字段，所有数据从服务器获取
 */
export const CHAT_SESSION_PERSIST: string[] = [
  // 所有数据都从服务器获取，不持久化到 localStorage
] as const;

/** Chat Sidebar Store - 持久化字段
 * 
 * 注意：
 * - sessions 从服务器获取（以当前工作目录为参数）
 * - selectedSessionId 从服务器获取（init 响应）
 * - workingDir 已由全局 workspaceStore 管理
 * 
 * Chat Sidebar Store 不再持久化任何字段，所有数据从服务器获取
 */
export const CHAT_SIDEBAR_PERSIST: string[] = [
  // 所有数据都从服务器获取，不持久化到 localStorage
] as const;
