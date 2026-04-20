/**
 * Session Config API
 *
 * Responsibilities: Session configuration operations via WebSocket
 * - Update session name
 * - Handle session config update responses
 */

import { websocketService } from "@/services/websocket.service";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";

/**
 * Update session name
 */
export function updateSessionName(sessionId: string, name: string): boolean {
  return websocketService.send("update_session_config", { sessionId, name });
}

/**
 * Setup WebSocket listener for session config updates
 */
export function setupSessionConfigListeners(): () => void {
  const unsubscribe = websocketService.on(
    "session_config_updated",
    (data: { sessionId: string; name?: string; success: boolean }) => {
      if (data.success && data.name) {
        // Update local store
        useSidebarStore.getState().updateSessionName(data.sessionId, data.name);
      }
    }
  );

  return unsubscribe;
}
