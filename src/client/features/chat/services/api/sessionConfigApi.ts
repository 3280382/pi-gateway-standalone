/**
 * Session Config API
 *
 * Responsibilities: Session configuration operations via WebSocket
 * - Update session name
 */

import { websocketService } from "@/services/websocket.service";

/**
 * Update session name
 */
export function updateSessionName(sessionId: string, name: string): boolean {
  return websocketService.send("update_session_config", { sessionId, name });
}
