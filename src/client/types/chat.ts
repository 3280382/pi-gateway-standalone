/**
 * Chat Types - Model and State Definitions
 */

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = "user" | "assistant" | "system";

export type ContentType = "text" | "thinking" | "tool" | "image";

export interface MessageContent {
	type: ContentType;
	text?: string;
	thinking?: string;
	signature?: string;
	toolCallId?: string;
	toolName?: string;
	args?: Record<string, unknown>;
	output?: string;
	error?: string;
	imageUrl?: string;
}

export interface Message {
	id: string;
	role: MessageRole;
	content: MessageContent[];
	timestamp: Date;
	isStreaming?: boolean;
	isThinkingCollapsed?: boolean;
	isMessageCollapsed?: boolean;
}

// ============================================================================
// Tool Execution Types
// ============================================================================

export type ToolStatus = "pending" | "executing" | "success" | "error";

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
// Search Filter Types
// ============================================================================

export interface ChatSearchFilters {
	user: boolean;
	assistant: boolean;
	thinking: boolean;
	tools: boolean;
	dates?: {
		from?: Date;
		to?: Date;
	};
}

// ============================================================================
// State Types
// ============================================================================

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
	scrollToBottom: boolean;

	// Search
	searchQuery: string;
	searchFilters: ChatSearchFilters;
	searchResults: string[]; // Message IDs that match search
	isSearching: boolean;

	// Model/Session
	currentModel: string | null;
	sessionId: string | null;
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
	deleteMessage: (messageId: string) => void;
	clearMessages: () => void;
	regenerateMessage: (messageId: string) => void;

	// Thinking Display
	setShowThinking: (show: boolean) => void;

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
	output?: string;
	error?: string;
}

export interface ToolEndMessage {
	type: "tool_end";
	toolCallId: string;
	output?: string;
	error?: string;
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
// Component Props
// ============================================================================

export interface MessageListProps {
	messages: Message[];
	currentStreamingMessage: Message | null;
	showThinking: boolean;
	onToggleMessageCollapse: (id: string) => void;
	onToggleThinkingCollapse: (id: string) => void;
}

export interface MessageItemProps {
	message: Message;
	showThinking: boolean;
	onToggleCollapse: () => void;
	onToggleThinking: () => void;
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
