/**
 * Session Message Types - Unified message format
 *
 * These types are used for both server-side and client-side message processing.
 * The server can return pre-processed messages to avoid client-side transformation.
 */

// ============================================================================
// Content Types
// ============================================================================

export interface TextContent {
  type: "text";
  text: string;
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface ToolUseContent {
  type: "tool_use";
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  partialArgs?: string;
  status?: "pending" | "executing" | "success" | "error";
}

export interface ToolResultContent {
  type: "tool";
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: "success" | "error";
}

export interface ImageContent {
  type: "image";
  imageUrl?: string;
  source?: {
    type: "base64";
    mediaType: string;
    data: string;
  };
}

export type MessageContent =
  | TextContent
  | ThinkingContent
  | ToolUseContent
  | ToolResultContent
  | ImageContent;

// ============================================================================
// Message Types - Three-level classification
// ============================================================================

/** Level 1: Message source category */
export type MessageKind1 = "user" | "assistant" | "sysinfo";

/** Level 2: Content type within each source */
export type MessageKind2 =
  | "prompt" // user
  | "response" // assistant - text response
  | "thinking" // assistant - thinking process
  | "tool" // assistant - tool execution
  | "event"; // sysinfo - system events

/** Level 3: Specific subtype */
export type MessageKind3 =
  // User subtypes
  | "text_prompt"
  | "image_prompt"
  // Assistant subtypes
  | "text_response"
  | "thinking_block"
  | "tool_call"
  | "tool_result"
  // Sysinfo event subtypes
  | "model_change"
  | "thinking_level_change"
  | "compaction"
  | "retry"
  | "auto_retry"
  | "usage"
  | "export"
  | undefined;

/** Legacy types - kept for backward compatibility */
export type MessageRole = MessageKind1;
export type MessageKind = MessageKind3;

export interface Message {
  id: string;
  /** Level 1: user | ai | system */
  kind1: MessageKind1;
  /** Level 2: prompt | response | thinking | tool | event */
  kind2: MessageKind2;
  /** Level 3: specific subtype */
  kind3?: MessageKind3;
  /** Legacy field - maps to kind1 */
  role: MessageRole;
  /** Legacy field - maps to kind3 */
  kind?: MessageKind;
  content: MessageContent[];
  timestamp: string | Date;
  isStreaming?: boolean;
  isThinkingCollapsed?: boolean;
  isToolsCollapsed?: boolean;
  isMessageCollapsed?: boolean;
  usage?: {
    input?: number;
    output?: number;
    total?: number;
    cost?: number;
    model?: string;
  };
  model?: string;
  provider?: string;
  stopReason?: string;
}

// ============================================================================
// Server Response Types
// ============================================================================

/**
 * Server response format for session messages
 * When processed=true, messages are already normalized
 */
export interface SessionMessagesResponse {
  messages: Message[];
  totalCount: number;
  processed: boolean; // true = server pre-processed, false = raw entries
  sessionFile: string;
  pagination?: {
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  error?: string; // Error message if processing failed
}

/**
 * WebSocket init response with pre-processed messages
 */
export interface InitSessionResponse {
  pid: number;
  workingDir: string;
  currentSession: {
    sessionId: string;
    sessionFile: string;
    shortId: string;
    messages: Message[]; // Pre-processed by server
    totalMessageCount: number;
    processed: boolean;
  };
  allSessions: Array<{
    id: string;
    path: string;
    name: string;
    messageCount: number;
    lastModified: string;
    status?: string;
    hasClient?: boolean;
  }>;
  currentModel: string | null;
  defaultModel: string | null;
  allModels: Array<{
    id: string;
    name: string;
    provider?: string;
    maxTokens?: number;
    contextWindow?: number;
    reasoning?: boolean;
    input?: string[];
  }>;
  thinkingLevel: string;
}
