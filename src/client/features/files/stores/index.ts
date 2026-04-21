/**
 * Files Feature Stores
 */

export type { FileActions, FileState } from "@/features/files/stores/fileStore";
export { useFileStore } from "@/features/files/stores/fileStore";

// WebSocket Terminal Store (new multi-session terminal)
export {
  selectActiveSession,
  selectIsPanelOpen,
  selectPanelHeight,
  selectSessions,
  type TerminalActions,
  type TerminalSessionState,
  type TerminalState,
  useTerminalStore,
} from "@/features/files/stores/terminalStore";

// Legacy viewer store (keep for backward compatibility)
export {
  type FileViewerState,
  type TerminalActions as LegacyTerminalActions,
  type TerminalState as LegacyTerminalState,
  useFileViewerStore,
  useTerminalStore as useLegacyTerminalStore,
  useViewerStore,
  type ViewerMode,
} from "@/features/files/stores/viewerStore";
// workspaceStore 已移除 - recentWorkspaces 功能未使用
