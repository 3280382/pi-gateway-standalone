/**
 * API错误定义
 * 定义应用程序中的API错误类型
 */

import type {
	ApiError as ApiErrorType,
	ErrorCode,
} from "../../../shared/types/api.types";

export class ApiError extends Error implements ApiErrorType {
	public code: ErrorCode | string;
	public details?: Record<string, any>;
	public statusCode: number;
	public isOperational: boolean;
	public timestamp: number;

	constructor(
		code: ErrorCode | string,
		message: string,
		statusCode = 500,
		details?: Record<string, any>,
		isOperational = true,
	) {
		super(message);

		this.code = code;
		this.details = details;
		this.statusCode = statusCode;
		this.isOperational = isOperational;
		this.timestamp = Date.now();

		// 确保正确的原型链
		Object.setPrototypeOf(this, ApiError.prototype);

		// 捕获堆栈跟踪
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ApiError);
		}
	}

	toJSON(): ApiErrorType {
		return {
			code: this.code,
			message: this.message,
			details: this.details,
			stack: this.stack,
		};
	}

	toString(): string {
		return `[${this.code}] ${this.message}`;
	}
}

// 具体的错误类型
export class ValidationError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("VALIDATION_ERROR", message, 400, details);
		this.name = "ValidationError";
	}
}

export class NotFoundError extends ApiError {
	constructor(resource: string, id?: string) {
		const message = id ? `${resource} ${id} 未找到` : `${resource} 未找到`;
		super("NOT_FOUND", message, 404, { resource, id });
		this.name = "NotFoundError";
	}
}

export class UnauthorizedError extends ApiError {
	constructor(message = "未授权访问") {
		super("UNAUTHORIZED", message, 401);
		this.name = "UnauthorizedError";
	}
}

export class ForbiddenError extends ApiError {
	constructor(message = "禁止访问") {
		super("FORBIDDEN", message, 403);
		this.name = "ForbiddenError";
	}
}

export class ConflictError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("CONFLICT", message, 409, details);
		this.name = "ConflictError";
	}
}

export class InternalError extends ApiError {
	constructor(message = "内部服务器错误", details?: Record<string, any>) {
		super("INTERNAL_ERROR", message, 500, details, false); // 非操作错误
		this.name = "InternalError";
	}
}

export class BadRequestError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("BAD_REQUEST", message, 400, details);
		this.name = "BadRequestError";
	}
}

export class TimeoutError extends ApiError {
	constructor(message = "请求超时", details?: Record<string, any>) {
		super("TIMEOUT", message, 408, details);
		this.name = "TimeoutError";
	}
}

// 业务错误
export class ChatError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("CHAT_ERROR", message, 500, details);
		this.name = "ChatError";
	}
}

export class FileError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("FILE_ERROR", message, 500, details);
		this.name = "FileError";
	}
}

export class SessionError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("SESSION_ERROR", message, 500, details);
		this.name = "SessionError";
	}
}

export class LLMError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("LLM_ERROR", message, 500, details);
		this.name = "LLMError";
	}
}

export class ToolError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("TOOL_ERROR", message, 500, details);
		this.name = "ToolError";
	}
}

// 网络错误
export class NetworkError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("NETWORK_ERROR", message, 503, details);
		this.name = "NetworkError";
	}
}

export class WebSocketError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("WEBSOCKET_ERROR", message, 503, details);
		this.name = "WebSocketError";
	}
}

export class ConnectionError extends ApiError {
	constructor(message: string, details?: Record<string, any>) {
		super("CONNECTION_ERROR", message, 503, details);
		this.name = "ConnectionError";
	}
}

// 错误工厂
export class ErrorFactory {
	static validation(
		message: string,
		details?: Record<string, any>,
	): ValidationError {
		return new ValidationError(message, details);
	}

	static notFound(resource: string, id?: string): NotFoundError {
		return new NotFoundError(resource, id);
	}

	static unauthorized(message?: string): UnauthorizedError {
		return new UnauthorizedError(message);
	}

	static forbidden(message?: string): ForbiddenError {
		return new ForbiddenError(message);
	}

	static conflict(
		message: string,
		details?: Record<string, any>,
	): ConflictError {
		return new ConflictError(message, details);
	}

	static internal(
		message?: string,
		details?: Record<string, any>,
	): InternalError {
		return new InternalError(message, details);
	}

	static badRequest(
		message: string,
		details?: Record<string, any>,
	): BadRequestError {
		return new BadRequestError(message, details);
	}

	static timeout(
		message?: string,
		details?: Record<string, any>,
	): TimeoutError {
		return new TimeoutError(message, details);
	}

	static chat(message: string, details?: Record<string, any>): ChatError {
		return new ChatError(message, details);
	}

	static file(message: string, details?: Record<string, any>): FileError {
		return new FileError(message, details);
	}

	static session(message: string, details?: Record<string, any>): SessionError {
		return new SessionError(message, details);
	}

	static llm(message: string, details?: Record<string, any>): LLMError {
		return new LLMError(message, details);
	}

	static tool(message: string, details?: Record<string, any>): ToolError {
		return new ToolError(message, details);
	}
}
