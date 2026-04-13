/**
 * Persist Config - Files Feature
 *
 * Files 功能相关的持久化配置
 */

// ============================================================================
// Storage Keys
// ============================================================================

export const FILES_STORAGE_KEYS = {
  FILES_BROWSER: "pi:files:browser",
  FILES_WORKSPACE: "pi:files:workspace",
} as const;

// ============================================================================
// Storage Versions
// ============================================================================

export const FILES_STORAGE_VERSION = {
  FILES_BROWSER: 1,
  FILES_WORKSPACE: 1,
} as const;

// ============================================================================
// Persist Fields
// ============================================================================

/** Files Browser Store - 持久化字段
 * 注意：workingDir 已由全局 workspaceStore (pi:app:workspace) 管理，不再在此处持久化
 */
export const FILES_BROWSER_PERSIST = [
  // "workingDir", // 已由全局 workspaceStore (pi:app:workspace) 管理
  "viewMode",
  "sortMode",
  "filterType",
  "isSidebarVisible",
  "bottomPanelHeight",
  "isGitModeActive",
  "isTodoModeActive",
] as const;

/** Files Workspace Store - 持久化字段 */
export const FILES_WORKSPACE_PERSIST = ["recentWorkspaces"] as const;
