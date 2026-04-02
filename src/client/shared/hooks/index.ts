/**
 * Shared Hooks - 全局共享 Hooks
 */

export {
  useAppInitialization,
  useChatMessages,
  useTerminalCommands,
} from "./app";

// Feature hooks (re-export for backward compatibility)
export { useChat } from "@/features/chat/hooks";
export { useDragDrop, useGesture } from "@/features/files/hooks";
