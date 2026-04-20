/**
 * Chat-related type definitions
 * Core chat data structures shared between frontend and backend
 */

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = "user" | "assistant" | "system";

export type ContentType = "text" | "thinking" | "tool" | "tool_use" | "image" | "turn_marker";

export interface MessageContent {
  type: ContentType;
  text?: string;
  thinking?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  partialArgs?: string;
  output?: string;
  error?: string;
  imageUrl?: string;
  signature?: string;
  toolCallId?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent[];
  timestamp: Date;
  isStreaming?: boolean;
  isThinkingCollapsed?: boolean;
  isToolsCollapsed?: boolean;
  isMessageCollapsed?: boolean;
}

// ============================================================================
// Tool Execution Types
// ============================================================================

export type ToolStatus = "pending" | "executing" | "success" | "error" | "cancelled";

export interface ToolExecution {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolStatus;
  output?: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

// ============================================================================
// Chat State Types (Frontend Use)
// ============================================================================

// Hierarchical Role Filters
export interface RoleFilters {
  user: boolean;
  assistant: boolean;
  system: boolean;
}

// Hierarchical Content Type Filters
export interface ContentTypeFilters {
  prompt: boolean;           // User messages
  text: boolean;             // Assistant text
  thinking: boolean;         // AI thinking
  tool: boolean;             // Tool calls
  compaction: boolean;       // Context compaction
  retry: boolean;            // Manual retry
  autoRetry: boolean;        // Auto-retry
  modelChange: boolean;      // Model switch
  thinkingLevelChange: boolean; // Thinking level
  usage: boolean;            // Token usage
}

export interface ChatSearchFilters {
  roles: RoleFilters;
  contentTypes: ContentTypeFilters;
  dates?: {
    from?: Date;
    to?: Date;
  };
}

export interface ChatState {
  // Messages
  messages: Message[];
  currentStreamingMessage: Message | null;

  // Input
  inputText: string;
  isInputFocused: boolean;

  // Streaming
  isStreaming: boolean;
  streamingContent: string;
  streamingThinking: string;

  // Tools
  activeTools: Map<string, ToolExecution>;

  // UI State
  showThinking: boolean;
  showTools: boolean;
  scrollToBottom: boolean;

  // Search
  searchQuery: string;
  searchFilters: ChatSearchFilters;
  searchResults: string[]; // Message IDs matching search
  isSearching: boolean;

  // Model/Session
  currentModel: string | null;
  sessionId: string | null;
}

// ============================================================================
// WebSocket Message Types (Shared Between Frontend and Backend)
// ============================================================================

export interface ContentDeltaMessage {
  type: "content";
  text: string;
}

export interface ThinkingDeltaMessage {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface ToolCallDeltaMessage {
  type: "toolcall_delta";
  toolCallId: string;
  toolName: string;
  delta: string;
  args?: Record<string, unknown>;
}

export interface ToolStartMessage {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolUpdateMessage {
  type: "tool_update";
  toolCallId: string;
  chunk?: string;
  output?: string;
  error?: string;
}

export interface ToolEndMessage {
  type: "tool_end";
  toolCallId: string;
  result?: string;
  isError?: boolean;
  output?: string;
  error?: string;
  fileContent?: string; // File content for write file operations
  filePath?: string; // File path for write file operations
}

export interface AgentStartMessage {
  type: "agent_start";
  model?: string;
}

export interface AgentEndMessage {
  type: "agent_end";
}

export type ChatWebSocketMessage =
  | ContentDeltaMessage
  | ThinkingDeltaMessage
  | ToolCallDeltaMessage
  | ToolStartMessage
  | ToolUpdateMessage
  | ToolEndMessage
  | AgentStartMessage
  | AgentEndMessage;

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SendMessageRequest {
  text: string;
  sessionId?: string;
  model?: string;
}

export interface SendMessageResponse {
  message: Message;
  sessionId: string;
}

export interface GetMessagesRequest {
  sessionId: string;
  limit?: number;
  offset?: number;
}

export interface GetMessagesResponse {
  messages: Message[];
  total: number;
  hasMore: boolean;
}
