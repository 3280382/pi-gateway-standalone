/**
 * Sidebar Types - Model and State Definitions
 */

// ============================================================================
// Domain Types
// ============================================================================

export interface WorkingDirectory {
  path: string;
  displayName: string;
}

export interface Session {
  id: string; // Short ID
  path: string; // Full path
  name: string;
  summary?: string; // Summary from first user prompt
  messageCount: number;
  lastModified: Date;
  firstMessage?: string;
  status?: string; // Runtime status: idle/thinking/tooling/streaming/waiting/error/retrying/compacting
  hasClient?: boolean;
}

export type Theme = "dark" | "light";
export type FontSize = "tiny" | "small" | "medium" | "large";

// ============================================================================
// State Types
// ============================================================================

export interface WorkspaceInfo {
  path: string;
  name?: string;
}

export interface SidebarState {
  // UI 状态
  isVisible: boolean;

  // LLM Log Panel 状态
  isBottomPanelOpen: boolean;
  bottomPanelHeight: number;

  // 运Rows时状态（全部来自 WebSocket，不持久化到 localStorage）
  workingDir: WorkingDirectory | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  selectedSessionId: string | null;

  // 运Rows时状态映射（sessionId -> status）
  runtimeStatus: Record<string, string>;
}

// ============================================================================
// Controller API Interface
// ============================================================================

export interface SidebarController {
  changeWorkingDir: (path: string) => Promise<void>;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface SessionsResponse {
  sessions: Array<{
    path: string;
    firstMessage?: string;
    messageCount: number;
    modified: string;
  }>;
}

export interface WorkingDirResponse {
  cwd: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export interface IconButtonProps {
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export interface SessionItemProps {
  session: Session;
  isSelected: boolean;
  onClick: () => void;
}
