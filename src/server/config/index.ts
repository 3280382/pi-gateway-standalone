/**
 * 配置管理模块
 * 集中管理应用程序配置
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Environment } from "../../shared/types/common.types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerConfig {
	env: Environment;
	port: number;
	host: string;
	cors: {
		origin: string | string[];
		credentials: boolean;
	};
	static: {
		path: string;
		maxAge: number;
		etag: boolean;
		lastModified: boolean;
	};
	websocket: {
		heartbeatInterval: number;
		heartbeatTimeout: number;
		maxConnections: number;
	};
	logging: {
		level: "error" | "warn" | "info" | "debug";
		format: "json" | "text";
	};
	llm: {
		logging: {
			enabled: boolean;
			truncateLimit: number;
		};
	};
	paths: {
		root: string;
		public: string;
		sessions: string;
		logs: string;
	};
}

export class Config {
	private static instance: Config;
	private config: ServerConfig;

	private constructor() {
		this.config = this.loadConfig();
	}

	/**
	 * 获取配置实例
	 */
	static getInstance(): Config {
		if (!Config.instance) {
			Config.instance = new Config();
		}
		return Config.instance;
	}

	/**
	 * 获取配置
	 */
	static get(): ServerConfig {
		return Config.getInstance().config;
	}

	/**
	 * 加载配置
	 */
	private loadConfig(): ServerConfig {
		const env = (process.env.NODE_ENV as Environment) || "development";
		const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
		const host = process.env.HOST || "127.0.0.1";

		const rootDir = path.resolve(__dirname, "../..");
		const publicDir = path.join(rootDir, "public");
		const sessionsDir = path.join(rootDir, ".pi", "sessions");
		const logsDir = path.join(rootDir, "logs");

		return {
			env,
			port,
			host,
			cors: {
				origin:
					env === "development"
						? ["http://127.0.0.1:5173", "http://localhost:5173", "*"]
						: host,
				credentials: true,
			},
			static: {
				path: publicDir,
				maxAge: env === "development" ? 0 : 3600000, // 1小时
				etag: env !== "development",
				lastModified: env !== "development",
			},
			websocket: {
				heartbeatInterval: 30000, // 30秒
				heartbeatTimeout: 60000, // 60秒
				maxConnections: 1000,
			},
			logging: {
				level:
					(process.env.LOG_LEVEL as any) ||
					(env === "development" ? "debug" : "info"),
				format: env === "production" ? "json" : "text",
			},
			llm: {
				logging: {
					enabled: process.env.LLM_LOGGING_ENABLED !== "false",
					truncateLimit: process.env.LLM_LOG_TRUNCATE_LIMIT
						? parseInt(process.env.LLM_LOG_TRUNCATE_LIMIT, 10)
						: 500000, // 500KB
				},
			},
			paths: {
				root: rootDir,
				public: publicDir,
				sessions: sessionsDir,
				logs: logsDir,
			},
		};
	}

	/**
	 * 检查是否是开发环境
	 */
	static isDevelopment(): boolean {
		return Config.get().env === "development";
	}

	/**
	 * 检查是否是生产环境
	 */
	static isProduction(): boolean {
		return Config.get().env === "production";
	}

	/**
	 * 检查是否是测试环境
	 */
	static isTest(): boolean {
		return Config.get().env === "test";
	}

	/**
	 * 获取端口
	 */
	static getPort(): number {
		return Config.get().port;
	}

	/**
	 * 获取主机
	 */
	static getHost(): string {
		return Config.get().host;
	}

	/**
	 * 获取CORS配置
	 */
	static getCorsConfig() {
		return Config.get().cors;
	}

	/**
	 * 获取静态文件配置
	 */
	static getStaticConfig() {
		return Config.get().static;
	}

	/**
	 * 获取WebSocket配置
	 */
	static getWebSocketConfig() {
		return Config.get().websocket;
	}

	/**
	 * 获取日志配置
	 */
	static getLoggingConfig() {
		return Config.get().logging;
	}

	/**
	 * 获取LLM日志配置
	 */
	static getLlmLogConfig() {
		return Config.get().llm.logging;
	}

	/**
	 * 获取路径配置
	 */
	static getPaths() {
		return Config.get().paths;
	}
}

// 便捷导出
export const config = Config.get();
export const isDevelopment = Config.isDevelopment;
export const isProduction = Config.isProduction;
export const isTest = Config.isTest;
