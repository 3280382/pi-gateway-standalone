/**
 * Files Feature Stores
 */

export type { FileActions, FileState } from "@/features/files/stores/fileStore";
export { useFileStore } from "@/features/files/stores/fileStore";
export {
  type FileViewerState,
  type TerminalActions,
  type TerminalState,
  useFileViewerStore,
  useTerminalStore,
  useViewerStore,
  type ViewerMode,
} from "@/features/files/stores/viewerStore";
// workspaceStore 已移除 - recentWorkspaces 功能未使用
