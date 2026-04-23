/**
 * Chat Types - Model and State Definitions
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
  signature?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  partialArgs?: string; // for streaming tool calls
  output?: string;
  error?: string;
  imageUrl?: string;
  turnNumber?: number;
  status?: ToolStatus; // for tool/tool_use to show execution status
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
  kind?:
    | "compaction"
    | "export"
    | "system"
    | "usage"
    | "retry"
    | "auto_retry"
    | "model_change"
    | "thinking_level_change"; // 特殊消息类型，用于样式区分和过滤
  // New 3-level classification (from server-side processing)
  kind1?: "user" | "assistant" | "sysinfo"; // Message source
  kind2?: "prompt" | "response" | "thinking" | "tool" | "event"; // Content type
  kind3?:
    | "text_prompt"
    | "text_response"
    | "thinking_block"
    | "tool_call"
    | "tool_result"
    | "tool_success"
    | "tool_error"
    | "model_change"
    | "thinking_level_change"
    | "compaction"
    | "retry"
    | "auto_retry"
    | "usage"
    | "export"; // Specific subtype
}

// ============================================================================
// Tool Execution Types
// ============================================================================

export type ToolStatus = "pending" | "executing" | "success" | "error" | "timeout";

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
// Search Types - Hierarchical Design (3-Level Classification)
// ============================================================================

// Level 1: Message source filters
export interface Kind1Filters {
  user: boolean;
  assistant: boolean;
  sysinfo: boolean;
}

// Level 2: Content type filters
export interface Kind2Filters {
  prompt: boolean; // User prompts
  response: boolean; // Assistant text responses
  thinking: boolean; // AI thinking blocks
  tool: boolean; // Tool calls and results
  event: boolean; // System events
}

// Level 3: Specific subtype filters
export interface Kind3Filters {
  // System events
  compaction: boolean;
  retry: boolean;
  autoRetry: boolean;
  modelChange: boolean;
  thinkingLevelChange: boolean;
  usage: boolean;
  // Tool statuses
  toolSuccess: boolean;
  toolError: boolean;
  toolPending: boolean;
}

// Hierarchical filters (new 3-level system)
export interface ChatSearchFilters {
  kind1: Kind1Filters;
  kind2: Kind2Filters;
  kind3: Kind3Filters;
  dates?: {
    from?: Date;
    to?: Date;
  };
}

// Legacy filter support (for backward compatibility)
export type LegacyChatSearchFilters = {
  user: boolean;
  assistant: boolean;
  system: boolean;
  thinking: boolean;
  tools: boolean;
  compaction: boolean;
  modelChange: boolean;
  thinkingLevelChange: boolean;
  usage: boolean;
  retry: boolean;
  autoRetry: boolean;
};

export interface SearchResult {
  messageId: string;
  indices: number[];
  preview: string;
}

// ============================================================================
// State Types
// ============================================================================

export interface ChatState {
  // Messages
  messages: Message[];
  currentStreamingMessage: Message | null;
  setMessages: (messages: Message[]) => void;

  // Input
  inputText: string;
  isInputFocused: boolean;
  setInputText: (text: string) => void;
  clearInput: () => void;

  // Streaming
  isStreaming: boolean;
  streamingContent: string;
  streamingThinking: string;
  startStreaming: () => void;
  appendStreamingContent: (text: string) => void;
  appendStreamingThinking: (thinking: string) => void;
  abortStreaming: () => void;
  finishStreaming: () => void;

  // Tools
  activeTools: Map<string, ToolExecution>;
  setActiveTool: (tool: ToolExecution) => void;
  updateToolOutput: (toolId: string, output: string, error?: string) => void;

  // Streaming Tool Calls (for incremental display)
  streamingToolCalls: Map<string, { id: string; name: string; args: string }>;
  appendToolCallDelta: (toolCallId: string, toolName: string, delta: string) => void;

  // UI State
  showThinking: boolean;
  setShowThinking: (show: boolean) => void;

  // Search
  searchQuery: string;
  searchFilters: ChatSearchFilters;
  searchResults: SearchResult[];
  isSearching: boolean;
  currentSearchIndex: number;
  setSearchQuery: (query: string) => void;
  setSearchFilters: (filters: Partial<ChatSearchFilters>) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setSearching: (searching: boolean) => void;
  nextSearchResult: () => void;
  prevSearchResult: () => void;
  clearSearch: () => void;

  // Model/Session
  currentModel: string | null;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;

  // Message Actions
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  toggleMessageCollapse: (messageId: string) => void;
  toggleThinkingCollapse: (messageId: string) => void;
  loadSession: (sessionPath: string) => Promise<number>;
  reset: () => void;
}

// ============================================================================
// Controller API Interface
// ============================================================================

export interface ChatController {
  // Message Sending
  sendMessage: (text: string, images?: any[]) => Promise<void>;
  abortGeneration: () => void;

  // Input
  setInputText: (text: string) => void;
  clearInput: () => void;

  // Message Actions
  toggleMessageCollapse: (messageId: string) => void;
  toggleThinkingCollapse: (messageId: string) => void;
  toggleToolsCollapse: (messageId: string) => void;
  clearMessages: () => void;

  // Thinking Display
  setShowThinking: (show: boolean) => void;

  // Tools Display
  setShowTools: (show: boolean) => void;
}

// ============================================================================
// WebSocket Message Types
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
  chunk?: string; // 后端发送的是chunk字段
  error?: string;
}

export interface ToolEndMessage {
  type: "tool_end";
  toolCallId: string;
  result?: string; // 后端发送的是result字段
  isError?: boolean; // 后端发送的是isError字段
}

export interface AgentStartMessage {
  type: "agent_start";
  model?: string;
}

export interface AgentEndMessage {
  type: "agent_end";
}

export interface MessageStartMessage {
  type: "message_start";
}

export interface MessageEndMessage {
  type: "message_end";
}

export interface TurnStartMessage {
  type: "turn_start";
}

export interface TurnEndMessage {
  type: "turn_end";
  message?: any;
  toolResults?: any[];
}

export interface QueueUpdateMessage {
  type: "queue_update";
  steering: readonly string[];
  followUp: readonly string[];
}

export interface CompactionStartMessage {
  type: "compaction_start";
  reason: "manual" | "threshold" | "overflow";
}

export interface CompactionEndMessage {
  type: "compaction_end";
  reason: "manual" | "threshold" | "overflow";
  result?: any;
  aborted: boolean;
  willRetry: boolean;
  errorMessage?: string;
}

export interface AutoRetryStartMessage {
  type: "auto_retry_start";
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  errorMessage: string;
}

export interface AutoRetryEndMessage {
  type: "auto_retry_end";
  success: boolean;
  attempt: number;
  finalError?: string;
}

export interface RetryStartMessage {
  type: "retry_start";
}

export interface RetryEndMessage {
  type: "retry_end";
}

export type ChatWebSocketMessage =
  | ContentDeltaMessage
  | ThinkingDeltaMessage
  | ToolCallDeltaMessage
  | ToolStartMessage
  | ToolUpdateMessage
  | ToolEndMessage
  | AgentStartMessage
  | AgentEndMessage
  | MessageStartMessage
  | MessageEndMessage
  | TurnStartMessage
  | TurnEndMessage
  | QueueUpdateMessage
  | CompactionStartMessage
  | CompactionEndMessage
  | AutoRetryStartMessage
  | AutoRetryEndMessage
  | RetryStartMessage
  | RetryEndMessage;

// ============================================================================
// Component Props
// ============================================================================

export interface MessageListProps {
  messages: Message[];
  currentStreamingMessage: Message | null;
  showThinking: boolean;
  onToggleMessageCollapse: (id: string) => void;
  onToggleThinkingCollapse: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
  onRegenerateMessage?: (id: string) => void;
}

export interface MessageItemProps {
  message: Message;
  showThinking: boolean;
  onToggleCollapse: () => void;
  onToggleThinking: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
}

export interface InputAreaProps {
  value: string;
  isStreaming: boolean;
  onChange: (text: string) => void;
  onSend: () => void;
  onAbort: () => void;
}

export interface ToolExecutionProps {
  tool: ToolExecution;
  isExpanded: boolean;
  onToggleExpand: () => void;
}
