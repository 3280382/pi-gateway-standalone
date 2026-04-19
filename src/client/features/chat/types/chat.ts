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
// Search Types
// ============================================================================

export interface ChatSearchFilters {
  user: boolean;
  assistant: boolean;
  system: boolean;
  thinking: boolean;
  tools: boolean;
  compaction: boolean;
  modelChange: boolean;
  thinkingLevelChange: boolean;
  usage: boolean; // Usage/cost information
  dates?: {
    from?: Date;
    to?: Date;
  };
}

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
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (messageId: string) => void;
  clearMessages: () => void;
  toggleMessageCollapse: (messageId: string) => void;
  toggleThinkingCollapse: (messageId: string) => void;
  regenerateMessage: (messageId: string) => void;
  loadSession: (sessionPath: string) => Promise<number>;
  reset: () => void;
}

// ============================================================================
// Controller API Interface
// ============================================================================

export interface ChatController {
  // Message Sending
  sendMessage: (text: string) => Promise<void>;
  abortGeneration: () => void;

  // Input
  setInputText: (text: string) => void;
  clearInput: () => void;

  // Message Actions
  toggleMessageCollapse: (messageId: string) => void;
  toggleThinkingCollapse: (messageId: string) => void;
  toggleToolsCollapse: (messageId: string) => void;
  deleteMessage: (messageId: string) => void;
  clearMessages: () => void;
  regenerateMessage: (messageId: string) => void;

  // Thinking Display
  setShowThinking: (show: boolean) => void;

  // Tools Display
  setShowTools: (show: boolean) => void;

  // Tool Actions
  expandToolOutput: (toolId: string) => void;
  collapseToolOutput: (toolId: string) => void;
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

export interface CompactionStartMessage {
  type: "compaction_start";
}

export interface CompactionEndMessage {
  type: "compaction_end";
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
  | CompactionStartMessage
  | CompactionEndMessage
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
