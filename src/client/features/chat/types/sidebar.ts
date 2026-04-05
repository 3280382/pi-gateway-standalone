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
	// 运行时状态（不持久化）
	workingDir: WorkingDirectory | null;
	sessions: Session[];
	isLoading: boolean;
	error: string | null;
	selectedSessionId: string | null;

	// 持久化状态（唯一存储）
	lastSessionByDir: Record<string, string>;
}

// ============================================================================
// Controller API Interface
// ============================================================================

export interface SidebarController {
	// Data Loading
	loadWorkingDir: () => Promise<void>;
	loadSessions: (cwd: string) => Promise<void>;

	// Actions
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
