/**
 * Services export - Unified entry
 *
 * Global shared services direct export
 * Feature services compatibility via re-export
 */

// Feature services (re-export for backward compatibility)
export {
  setupWebSocketListeners,
  useChatController,
} from "@/features/chat/services/api/chatApi";
export { useSidebarController } from "@/features/chat/services/api/sidebarApi";
export * as fileApi from "@/features/files/services/api/fileApi";

// API Client
export { fetchApi } from "./client";

// WebSocket
export { ServiceError, websocketService } from "./websocket.service";
