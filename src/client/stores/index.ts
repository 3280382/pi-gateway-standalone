/**
 * Stores 导出 - 统一入口
 *
 * 全局共享 stores 直接导出
 * Feature stores 通过 re-export 保持兼容性
 */

// Feature stores (re-export for backward compatibility)
export {
	filterMessages,
	selectCurrentSearchIndex,
	selectCurrentStreamingMessage,
	selectInputText,
	selectIsSearching,
	selectIsStreaming,
	selectMessages,
	selectSearchFilters,
	selectSearchQuery,
	selectSearchResults,
	selectShowThinking,
	useChatStore,
	useLlmLogStore,
	useModalStore,
	useSidebarStore,
} from "@/features/chat/stores";
export { useFileStore, useFileViewerStore } from "@/features/files/stores";
// Global stores
export { useSessionStore } from "./sessionStore";
