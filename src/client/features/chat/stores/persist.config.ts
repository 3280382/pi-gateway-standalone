/**
 * Persist Config - Chat Feature
 *
 * Chat 功能相关的持久化配置
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

/** Chat Session Store - 持久化字段 */
export const CHAT_SESSION_PERSIST = [
	"currentSessionId",
	"workingDir",
	"currentModel",
	"thinkingLevel",
] as const;

/** Chat Sidebar Store - 持久化字段 */
export const CHAT_SIDEBAR_PERSIST = [
	"lastSessionByDir",
] as const;
