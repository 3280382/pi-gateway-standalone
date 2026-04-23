/**
 * Session Module - Unified session management exports
 *
 * All session-related functionality is centralized here:
 * - PiAgentSession: Core session lifecycle management
 * - SessionRegistry: Server-level session registry and routing
 * - SessionFile: File I/O, message processing, and response building
 * - SessionConfig: Session metadata persistence
 * - MessageProcessor: Entry-to-message format conversion
 * - utils: Shared utility functions
 */

export { PiAgentSession, type ServerMessage } from "./PiAgentSession.js";
export {
  ServerSessionManager,
  extractShortSessionId,
  serverSessionManager,
} from "./SessionRegistry.js";
export type { SessionStatus } from "./SessionRegistry.js";
