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
  id: string;
  path: string;
  name: string;
  messageCount: number;
  lastModified: Date;
  firstMessage?: string;
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

  // 运行时状态（全部来自 WebSocket，不持久化到 localStorage）
  workingDir: WorkingDirectory | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  selectedSessionId: string | null;
}

// ============================================================================
// Controller API Interface
// ============================================================================

export interface SidebarController {
  // Data Loading - 数据来自 WebSocket init，不再需要 HTTP 加载
  loadWorkingDir: () => Promise<void>;
  loadSessions: (cwd: string) => Promise<void>;

  // Actions - WebSocket
  changeWorkingDir: (path: string) => Promise<void>;
  selectSession: (id: string) => void;
  createNewSession: () => Promise<void>;

  // Error Handling
  clearError: () => void;
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
