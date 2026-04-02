/**
 * Shared Hooks - 全局共享 Hooks
 */

// Feature hooks (re-export for backward compatibility)
export { useChat } from "@/features/chat/hooks";
export { useDragDrop, useGesture } from "@/features/files/hooks";
export {
	useAppInitialization,
	useChatMessages,
	useTerminalCommands,
} from "./app";
