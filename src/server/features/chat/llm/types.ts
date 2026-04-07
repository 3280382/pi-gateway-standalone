/**
 * LLM Log Type Definitions
 */

export interface LlmLogEntry {
	timestamp: string;
	type: "request" | "response";
	model?: string;
	content: string;
}

export interface LlmRequestLog {
	method: string;
	url: string;
	protocol: string;
	host: string;
	pathname: string;
	search: string;
	headers: Record<string, string>;
	body?: string;
	timestamp: string;
}

export interface LlmResponseLog {
	status: number;
	statusText: string;
	url: string;
	headers: Record<string, string>;
	body?: string;
	bodyNote?: string;
	duration: string;
	timestamp: string;
}

export interface LlmLogOptions {
	enabled?: boolean;
	maxBufferSize?: number;
	flushInterval?: number;
	truncateLimit?: number;
}

export interface LlmHostConfig {
	hosts: string[];
	truncateLimit: number;
}

export interface LlmInterceptorOptions extends LlmLogOptions {
	setupHttpInterceptor?: boolean;
	hosts?: string[];
}
