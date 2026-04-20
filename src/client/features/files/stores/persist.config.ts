/**
 * Persist Config - Files Feature
 *
 * Files 功能相关的Persistence config
 */

// ============================================================================
// Storage Keys
// ============================================================================

export const FILES_STORAGE_KEYS = {
  FILES_BROWSER: "pi:files:browser",
  // FILES_WORKSPACE 已移除 - recentWorkspaces 功能未使用
} as const;

// ============================================================================
// Storage Versions
// ============================================================================

export const FILES_STORAGE_VERSION = {
  FILES_BROWSER: 1,
} as const;

// ============================================================================
// Persist Fields
// ============================================================================

/** Files Browser Store - 持久化字段
 * 注意：
 * - workingDir 已由全局 workspaceStore (pi:app:workspace) 管理
 * - currentBrowsePath: 当前浏览路径，持久化以便Refresh后恢复位置
 * - isGitModeActive/isTodoModeActive 是临时状态，不持久化
 */
export const FILES_BROWSER_PERSIST = [
  // "workingDir", // 已由全局 workspaceStore (pi:app:workspace) 管理
  "currentBrowsePath", // 当前浏览路径，Refresh后恢复
  "viewMode",
  "sortMode",
  "filterType",
  "isSidebarVisible",
  "bottomPanelHeight",
  // "isGitModeActive", // 临时状态，每次启动重置
  // "isTodoModeActive", // 临时状态，每次启动重置
] as const;

// FILES_WORKSPACE 已移除 - recentWorkspaces 功能未使用
export const FILES_WORKSPACE_PERSIST = [] as const;
