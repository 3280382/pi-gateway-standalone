/**
 * Configuration management module
 * Centralized application configuration management
 */

import { existsSync } from "node:fs";
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
   * Get configuration instance
   */
  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Get configuration
   */
  static get(): ServerConfig {
    return Config.getInstance().config;
  }

  /**
   * Load configuration
   */
  private loadConfig(): ServerConfig {
    const env = (process.env.NODE_ENV as Environment) || "development";
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3300;
    const host = process.env.HOST || "127.0.0.1";

    // Find project root - check multiple possible locations
    let rootDir = path.resolve(__dirname, "../..");
    // If we're in src/server/config, go up one more level
    if (!existsSync(path.join(rootDir, "package.json"))) {
      rootDir = path.resolve(__dirname, "../../..");
    }
    // Fallback to process.cwd() if still not found
    if (!existsSync(path.join(rootDir, "package.json"))) {
      rootDir = process.cwd();
    }

    // Use dist folder if it exists (built frontend), otherwise fall back to public
    const distDir = path.join(rootDir, "dist");
    const publicDir = path.join(rootDir, "public");
    const staticDir = existsSync(distDir) ? distDir : publicDir;
    const sessionsDir = path.join(rootDir, ".pi", "sessions");
    const logsDir = path.join(rootDir, "logs");

    return {
      env,
      port,
      host,
      cors: {
        origin:
          env === "development" ? ["http://127.0.0.1:5173", "http://localhost:5173", "*"] : host,
        credentials: true,
      },
      static: {
        path: staticDir,
        maxAge: env === "development" ? 0 : 3600000, // 1 hour
        etag: env !== "development",
        lastModified: env !== "development",
      },
      websocket: {
        heartbeatInterval: 30000, // 30 seconds
        heartbeatTimeout: 60000, // 60 seconds
        maxConnections: 1000,
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || (env === "development" ? "debug" : "info"),
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
   * Check if development environment
   */
  static isDevelopment(): boolean {
    return Config.get().env === "development";
  }

  /**
   * Check if production environment
   */
  static isProduction(): boolean {
    return Config.get().env === "production";
  }

  /**
   * Check if test environment
   */
  static isTest(): boolean {
    return Config.get().env === "test";
  }

  /**
   * Get port
   */
  static getPort(): number {
    return Config.get().port;
  }

  /**
   * Get host
   */
  static getHost(): string {
    return Config.get().host;
  }

  /**
   * Get CORS configuration
   */
  static getCorsConfig() {
    return Config.get().cors;
  }

  /**
   * Get static file configuration
   */
  static getStaticConfig() {
    return Config.get().static;
  }

  /**
   * Get WebSocket configuration
   */
  static getWebSocketConfig() {
    return Config.get().websocket;
  }

  /**
   * Get logging configuration
   */
  static getLoggingConfig() {
    return Config.get().logging;
  }

  /**
   * Get LLM log configuration
   */
  static getLlmLogConfig() {
    return Config.get().llm.logging;
  }

  /**
   * Get paths configuration
   */
  static getPaths() {
    return Config.get().paths;
  }
}

// Convenience exports
export const config = Config.get();
export const isDevelopment = Config.isDevelopment;
export const isProduction = Config.isProduction;
export const isTest = Config.isTest;
