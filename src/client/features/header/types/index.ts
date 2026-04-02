/**
 * Header Feature Types
 */

export type ConnectionStatus = "connected" | "disconnected" | "connecting";

export interface HeaderProps {
	workingDir: string;
	connectionStatus: ConnectionStatus;
	pid: number | null;
	currentView?: "chat" | "files";
}

export interface SearchFilters {
	user: boolean;
	assistant: boolean;
	thinking: boolean;
	tools: boolean;
}

export interface SearchBoxProps {
	query: string;
	filters: SearchFilters;
	onQueryChange: (query: string) => void;
	onFiltersChange: (filters: SearchFilters) => void;
}

export interface Model {
	id: string;
	name: string;
	provider: string;
}

export interface ModelSelectorProps {
	models: Model[];
	currentModel: string | null;
	isLoading: boolean;
	isStreaming: boolean;
	onSelect: (modelId: string) => void;
}

export interface ThinkingLevel {
	id: string;
	name: string;
	icon: string;
}

export interface ThinkingSelectorProps {
	currentLevel: string;
	isStreaming: boolean;
	onSelect: (level: string) => void;
}

export interface DirectoryPickerProps {
	currentPath: string;
	onSelect: (path: string) => void;
	onClose: () => void;
}

export interface ConnectionStatusProps {
	status: ConnectionStatus;
	pid: number | null;
}
