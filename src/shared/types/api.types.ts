/**
 * API-related type definitions
 * Shared API request/response formats between frontend and backend
 */

// ============================================================================
// Generic API Response Format
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface ApiMeta {
  timestamp: string;
  requestId: string;
  pagination?: PaginationMeta;
  cache?: CacheMeta;
  warnings?: string[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CacheMeta {
  hit: boolean;
  key?: string;
  ttl?: number;
  age?: number;
}

// ============================================================================
// Error Code Definitions
// ============================================================================

export enum ErrorCode {
  // Generic errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  BAD_REQUEST = "BAD_REQUEST",
  CONFLICT = "CONFLICT",
  TIMEOUT = "TIMEOUT",

  // Business errors
  CHAT_ERROR = "CHAT_ERROR",
  FILE_ERROR = "FILE_ERROR",
  SESSION_ERROR = "SESSION_ERROR",
  LLM_ERROR = "LLM_ERROR",
  TOOL_ERROR = "TOOL_ERROR",

  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  WEBSOCKET_ERROR = "WEBSOCKET_ERROR",
  CONNECTION_ERROR = "CONNECTION_ERROR",
}

// ============================================================================
// API Version and Status
// ============================================================================

export interface ApiVersion {
  version: string;
  contractVersion: string;
  timestamp: string;
  deprecated?: boolean;
  sunsetDate?: string;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  services: Record<string, ServiceStatus>;
  metrics?: Record<string, any>;
}

export interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  lastCheck: string;
  latency?: number;
}

// ============================================================================
// Generic Request Types
// ============================================================================

export interface PaginationRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface FilterRequest {
  filters?: Record<string, any>;
  search?: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export type MaybePromise<T> = T | Promise<T>;

export type ApiHandler<TRequest = any, TResponse = any> = (
  req: TRequest,
  meta?: ApiMeta
) => MaybePromise<ApiResponse<TResponse>>;
