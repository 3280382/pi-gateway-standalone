/**
 * Footer Feature Types
 */

export interface FooterProps {
	isSidebarVisible: boolean;
	currentView: "chat" | "files";
	isBottomPanelOpen?: boolean;
	onToggleSidebar: () => void;
	onSwitchView: (view: "chat" | "files") => void;
	onToggleBottomPanel?: () => void;
}
