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

export interface SearchFilters {
	user: boolean;
	assistant: boolean;
	thinking: boolean;
	tools: boolean;
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
	// Data
	workingDir: WorkingDirectory | null;
	recentWorkspaces: (string | WorkspaceInfo)[];
	sessions: Session[];

	// Search
	searchQuery: string;
	searchFilters: SearchFilters;

	// Settings
	theme: Theme;
	fontSize: FontSize;

	// UI State
	isLoading: boolean;
	error: string | null;
	selectedSessionId: string | null;
}

// ============================================================================
// Controller API Interface
// ============================================================================

export interface SidebarController {
	// Data Loading
	loadWorkingDir: () => Promise<void>;
	loadRecentWorkspaces: () => Promise<void>;
	loadSessions: (cwd: string) => Promise<void>;

	// Actions
	changeWorkingDir: (path: string) => Promise<void>;
	selectSession: (id: string) => void;
	createNewSession: () => Promise<void>;

	// Search
	setSearchQuery: (query: string) => void;
	setSearchFilters: (filters: Partial<SearchFilters>) => void;

	// Settings
	setTheme: (theme: Theme) => void;
	setFontSize: (size: FontSize) => void;

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
