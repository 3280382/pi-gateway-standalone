/**
 * Main export file
 * Export all modules for external use
 */

// UI
export { SectionHeader } from "@/features/chat/components/SectionHeader/SectionHeader";
// Chat Feature
export { useChat } from "@/features/chat/hooks";
export { useChatMessages } from "@/features/chat/hooks/useChatMessages";
export {
  setupWebSocketListeners,
  useChatController,
} from "@/features/chat/services/api/chatApi";
export { useChatStore, useSessionStore } from "@/features/chat/stores";
export type {
  ChatState,
  ChatWebSocketMessage,
  Message,
  ToolExecution,
} from "@/features/chat/types";
// Files Feature
export * as fileApi from "@/features/files/services/api/fileApi";
export { useWorkspaceStore } from "@/stores/workspaceStore";
// Hooks
export { fetchApi } from "@/services/client";
// Services
export { ServiceError, websocketService } from "@/services/websocket.service";
