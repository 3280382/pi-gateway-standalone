/**
 * Message Utilities - Shared message creation helpers
 */

import type { Message } from "@/features/chat/types/chat";

/**
 * Helper to handle server-preprocessed messages
 */
export function handleServerMessages(serverMessages: any[]): Message[] {
  if (!serverMessages?.length) return [];
  return serverMessages as Message[];
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a user message
 */
export function createUserMessage(text: string): Message {
  return {
    id: generateMessageId(),
    role: "user",
    kind1: "user",
    kind2: "prompt",
    content: [{ type: "text", text }],
    timestamp: new Date(),
  };
}

/**
 * Create a system info message
 */
export function createSystemMessage(text: string): Message {
  return {
    id: generateMessageId(),
    role: "system",
    kind1: "sysinfo",
    kind2: "event",
    content: [{ type: "text", text }],
    timestamp: new Date(),
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(error: unknown): Message {
  const errorText = error instanceof Error ? error.message : String(error);
  return createSystemMessage(`Command execution failed: ${errorText}`);
}
