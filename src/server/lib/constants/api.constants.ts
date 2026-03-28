/**
 * API常量定义
 */

// API版本
export const API_VERSION = "1.0.0";
export const CONTRACT_VERSION = "1.3.0";

// API路径前缀
export const API_PREFIX = "/api";
export const API_V1_PREFIX = "/api/v1";

// 默认分页设置
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE = 1;

// 默认排序
export const DEFAULT_SORT_FIELD = "createdAt";
export const DEFAULT_SORT_ORDER = "desc";

// 请求超时设置（毫秒）
export const REQUEST_TIMEOUT = 30000; // 30秒
export const UPLOAD_TIMEOUT = 60000; // 60秒
export const WEBSOCKET_TIMEOUT = 30000; // 30秒

// 速率限制
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15分钟
export const RATE_LIMIT_MAX_REQUESTS = 100; // 每个窗口最多100个请求

// 缓存设置（毫秒）
export const CACHE_TTL = {
	SHORT: 5 * 60 * 1000, // 5分钟
	MEDIUM: 30 * 60 * 1000, // 30分钟
	LONG: 60 * 60 * 1000, // 60分钟
	DAY: 24 * 60 * 60 * 1000, // 24小时
};

// 文件上传限制
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
	"text/plain",
	"text/markdown",
	"text/x-python",
	"application/javascript",
	"application/json",
	"application/xml",
	"text/html",
	"text/css",
	"image/jpeg",
	"image/png",
	"image/gif",
];

// 支持的LLM模型
export const SUPPORTED_MODELS = {
	"kimi-k2.5": {
		name: "Kimi Chat 2.5",
		provider: "moonshot",
		maxTokens: 128000,
		supportsImages: true,
		supportsTools: true,
	},
	"gpt-4o": {
		name: "GPT-4o",
		provider: "openai",
		maxTokens: 128000,
		supportsImages: true,
		supportsTools: true,
	},
	"claude-3-opus": {
		name: "Claude 3 Opus",
		provider: "anthropic",
		maxTokens: 200000,
		supportsImages: true,
		supportsTools: true,
	},
};

// 默认模型
export const DEFAULT_MODEL = "deepseek/deepseek-chat";

// 消息限制
export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_MESSAGES_PER_SESSION = 1000;
export const MAX_TOOL_CALLS_PER_MESSAGE = 10;

// 工具执行限制
export const MAX_TOOL_EXECUTION_TIME = 30000; // 30秒
export const MAX_TOOL_OUTPUT_SIZE = 10000; // 10KB

// 会话设置
export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟
export const MAX_SESSIONS_PER_USER = 100;

// WebSocket设置
export const WEBSOCKET_HEARTBEAT_INTERVAL = 30000; // 30秒
export const WEBSOCKET_HEARTBEAT_TIMEOUT = 60000; // 60秒
export const MAX_WEBSOCKET_CONNECTIONS = 1000;

// 响应头
export const RESPONSE_HEADERS = {
	"X-API-Version": API_VERSION,
	"X-Contract-Version": CONTRACT_VERSION,
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"X-XSS-Protection": "1; mode=block",
};

// 环境配置
export const ENV = {
	DEVELOPMENT: "development",
	TEST: "test",
	PRODUCTION: "production",
} as const;

export type Environment = (typeof ENV)[keyof typeof ENV];

// 日志级别
export const LOG_LEVELS = {
	ERROR: "error",
	WARN: "warn",
	INFO: "info",
	DEBUG: "debug",
	TRACE: "trace",
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

// 默认端口
export const DEFAULT_PORT = 3000;
export const DEFAULT_WS_PORT = 3001;

// 健康检查路径
export const HEALTH_CHECK_PATH = "/health";
export const READINESS_CHECK_PATH = "/ready";
export const LIVENESS_CHECK_PATH = "/live";

// 监控指标
export const METRICS_PATH = "/metrics";
export const METRICS_COLLECTION_INTERVAL = 15000; // 15秒
