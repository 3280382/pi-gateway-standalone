/**
 * WebSocket-related type definitions
 * Shared WebSocket communication formats between frontend and backend
 */

// ============================================================================
// WebSocket Event Types
// ============================================================================

export type WebSocketEvent =
	// Connection events
	| "connected"
	| "disconnected"
	| "error"
	| "ping"
	| "pong"

	// Chat events
	| "message"
	| "message_start"
	| "message_delta"
	| "message_end"
	| "thinking_start"
	| "thinking_delta"
	| "thinking_end"

	// Tool events
	| "tool_call"
	| "tool_call_delta"
	| "tool_start"
	| "tool_update"
	| "tool_end"
	| "tool_result"

	// Session events
	| "session_created"
	| "session_updated"
	| "session_deleted"
	| "session_loaded"

	// System events
	| "initialized"
	| "auto_compaction_begin"
	| "auto_compaction_end"
	| "system_message"

	// File events
	| "file_update"
	| "file_deleted"
	| "file_created";

// ============================================================================
// WebSocket Message Format
// ============================================================================

export interface WebSocketMessage {
	event: WebSocketEvent;
	data: any;
	timestamp: string;
	messageId?: string;
	sessionId?: string;
	correlationId?: string;
}

// ============================================================================
// Specific Event Data Definitions
// ============================================================================

export interface ConnectedData {
	clientId: string;
	sessionId?: string;
	serverTime: string;
	pid: number;
}

export interface ErrorData {
	code: string;
	message: string;
	details?: Record<string, any>;
}

export interface MessageData {
	id: string;
	role: "user" | "assistant" | "system";
	content: any[];
	timestamp: string;
	sessionId?: string;
}

export interface MessageDeltaData {
	messageId: string;
	delta: string;
	content: string;
}

export interface ThinkingDeltaData {
	messageId: string;
	delta: string;
	thinking: string;
}

export interface ToolCallData {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	messageId?: string;
}

export interface ToolCallDeltaData {
	toolCallId: string;
	delta: string;
	args: Record<string, unknown>;
}

export interface ToolStartData {
	toolCallId: string;
	toolName: string;
	args: Record<string, unknown>;
	startTime: string;
}

export interface ToolUpdateData {
	toolCallId: string;
	output?: string;
	error?: string;
	progress?: number;
}

export interface ToolEndData {
	toolCallId: string;
	output?: string;
	error?: string;
	endTime: string;
	duration: number;
}

export interface SessionData {
	id: string;
	name?: string;
	createdAt: string;
	updatedAt: string;
	workingDir: string;
	model?: string;
	messagesCount?: number;
}

export interface InitializedData {
	sessionId: string;
	workingDir: string;
	models: Array<{
		id: string;
		name: string;
		provider: string;
	}>;
	pid: number;
	serverStartTime: number;
}

export interface FileUpdateData {
	path: string;
	action: "created" | "modified" | "deleted" | "renamed";
	newPath?: string;
	timestamp: string;
}

// ============================================================================
// Client-Sent Messages
// ============================================================================

export interface ClientMessage {
	type: "chat" | "tool" | "session" | "system" | "ping";
	data: any;
	messageId?: string;
	timestamp?: string;
}

export interface ChatClientMessage {
	text: string;
	sessionId?: string;
	model?: string;
}

export interface ToolClientMessage {
	toolCallId: string;
	action: "execute" | "cancel" | "update";
	data?: any;
}

export interface SessionClientMessage {
	action: "create" | "load" | "update" | "delete";
	data?: any;
}

export interface SystemClientMessage {
	action: "init" | "ping" | "compaction";
	data?: any;
}

// ============================================================================
// WebSocket Connection Configuration
// ============================================================================

export interface WebSocketConfig {
	url: string;
	protocols?: string[];
	reconnect: boolean;
	reconnectInterval: number;
	maxReconnectAttempts: number;
	heartbeatInterval: number;
	heartbeatTimeout: number;
}

export interface WebSocketConnection {
	id: string;
	sessionId?: string;
	clientType: "frontend" | "backend" | "monitor";
	connectedAt: string;
	lastActivity: string;
	ip?: string;
	userAgent?: string;
}
