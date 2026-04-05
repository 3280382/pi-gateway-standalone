/**
 * Chat Feature - 聊天功能模块
 */

// Hooks
export { useChat } from "@/features/chat/hooks";
export { useChatController } from "@/features/chat/services/api/chatApi";
export { useSidebarController } from "@/features/chat/services/api/sidebarApi";
// Stores
export {
	selectCurrentSearchIndex,
	selectIsSearching,
	selectSearchFilters,
	selectSearchQuery,
	selectSearchResults,
	useChatStore,
	useSidebarStore,
} from "@/features/chat/stores";
// Types
export type {
	ChatSearchFilters,
	FontSize,
	Message,
	SearchResult,
	Session,
	SidebarState,
	Theme,
	ToolExecution,
} from "@/features/chat/types";
// Components
export {
	AppHeader,
	ChatPanel,
	InputArea,
	LlmLogPanel,
	MessageItem,
	MessageList,
	// Sidebar components
	RecentWorkspaces,
	Sessions,
	Settings,
	SidebarPanel,
	WorkingDirectory,
} from "./components";
// Layout & Page
export { ChatLayout } from "./layout";
export { ChatPage } from "./page";
