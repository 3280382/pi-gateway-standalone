/**
 * 聊天相关类型定义
 * 前后端共享的核心聊天数据结构
 */

// ============================================================================
// 消息类型
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
	isMessageCollapsed?: boolean;
}

// ============================================================================
// 工具执行类型
// ============================================================================

export type ToolStatus =
	| "pending"
	| "executing"
	| "success"
	| "error"
	| "cancelled";

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
// 聊天状态类型 (前端使用)
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

export interface ChatState {
	// 消息
	messages: Message[];
	currentStreamingMessage: Message | null;

	// 输入
	inputText: string;
	isInputFocused: boolean;

	// 流式传输
	isStreaming: boolean;
	streamingContent: string;
	streamingThinking: string;

	// 工具
	activeTools: Map<string, ToolExecution>;

	// UI状态
	showThinking: boolean;
	scrollToBottom: boolean;

	// 搜索
	searchQuery: string;
	searchFilters: ChatSearchFilters;
	searchResults: string[]; // 匹配搜索的消息ID
	isSearching: boolean;

	// 模型/会话
	currentModel: string | null;
	sessionId: string | null;
}

// ============================================================================
// WebSocket消息类型 (前后端共享)
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
// API请求/响应类型
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
