/**
 * Common type definitions
 * Basic types shared between frontend and backend
 */

// ============================================================================
// Basic Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

export type ValueOf<T> = T[keyof T];
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ============================================================================
// Function Types
// ============================================================================

export type AsyncFunction<T = any, R = any> = (...args: T[]) => Promise<R>;
export type SyncFunction<T = any, R = any> = (...args: T[]) => R;
export type VoidFunction<T = any> = (...args: T[]) => void;

export type Constructor<T = any> = new (...args: any[]) => T;

// ============================================================================
// Time Types
// ============================================================================

export type Timestamp = number; // Unix timestamp in milliseconds
export type ISODateString = string; // ISO 8601 date string

export interface TimeRange {
  start: Timestamp | ISODateString;
  end: Timestamp | ISODateString;
}

// ============================================================================
// File System Types
// ============================================================================

export type Path = string;
export type FileSize = number; // bytes

export interface FileStats {
  size: FileSize;
  modified: Timestamp;
  created?: Timestamp;
  accessed?: Timestamp;
  mode?: number;
  uid?: number;
  gid?: number;
}

// ============================================================================
// Network Types
// ============================================================================

export interface HttpHeaders {
  [key: string]: string | string[];
}

export interface HttpRequest {
  method: string;
  url: string;
  headers: HttpHeaders;
  body?: any;
  query?: Record<string, any>;
  params?: Record<string, any>;
}

export interface HttpResponse {
  status: number;
  headers: HttpHeaders;
  body?: any;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AppConfig {
  env: "development" | "test" | "production";
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  logging: {
    level: "error" | "warn" | "info" | "debug";
    format: "json" | "text";
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    max: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export interface AppError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;
  isOperational: boolean;
  timestamp: Timestamp;
}

// ============================================================================
// Event Types
// ============================================================================

export interface BaseEvent {
  type: string;
  timestamp: Timestamp;
  source: string;
  data: any;
}

export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => void;
export type EventFilter<T extends BaseEvent = BaseEvent> = (event: T) => boolean;

// ============================================================================
// Utility Types
// ============================================================================

export type Predicate<T> = (value: T) => boolean;
export type Comparator<T> = (a: T, b: T) => number;
export type Transformer<T, R> = (value: T) => R;

export interface Pair<K, V> {
  key: K;
  value: V;
}

export interface Range<T = number> {
  min: T;
  max: T;
}

// ============================================================================
// Enum Types
// ============================================================================

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
  TRACE = "trace",
}

export enum Environment {
  DEVELOPMENT = "development",
  TEST = "test",
  PRODUCTION = "production",
}

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
  HEAD = "HEAD",
  OPTIONS = "OPTIONS",
}
