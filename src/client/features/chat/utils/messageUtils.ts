/**
 * Message Utilities - Server message handling
 *
 * Server always returns preprocessed messages, client uses them directly
 */

import type { Message } from "@/features/chat/types/chat";

/**
 * Helper to handle server-preprocessed messages
 * Server always returns preprocessed messages, use them directly
 */
export function handleServerMessages(serverMessages: any[]): Message[] {
  if (!serverMessages?.length) return [];
  return serverMessages as Message[];
}
