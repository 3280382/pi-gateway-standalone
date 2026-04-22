/**
 * Logger utility
 * Provides structured logging functionality with optional file output
 * File output is enabled by default in production, auto-detected by NODE_ENV
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { LogLevel } from "../../../shared/types/common.types.js";

export { LogLevel };

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  source?: string;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: "json" | "text";
  includeTimestamp?: boolean;
  includeContext?: boolean;
  /** Log directory. Defaults: production→logs/prod, test→logs/test, dev→logs/dev */
  logDir?: string | null;
  /** Log file name. Defaults: production→server_{timestamp}.log, others→server.log */
  logFile?: string;
  /** Max file size in bytes before rotation. Default: 10MB */
  maxFileSize?: number;
}

function getDefaultLogDir(): string | null {
  const env = process.env.NODE_ENV;
  if (env === "production") return "logs/prod";
  if (env === "test") return "logs/test";
  // Development: enable file logging too for persistence
  return "logs/dev";
}

function getDefaultLogFile(): string {
  const env = process.env.NODE_ENV;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (env === "production") return `server_${timestamp}.log`;
  return "server.log";
}

export class Logger {
  private static instance: Logger;
  private options: Required<Omit<LoggerOptions, "logDir" | "logFile">> & {
    logDir: string | null;
    logFile: string;
  };
  private logFilePath: string | null = null;

  constructor(options: LoggerOptions = {}) {
    const defaultDir = getDefaultLogDir();
    this.options = {
      level: options.level || LogLevel.INFO,
      format: options.format || "text",
      includeTimestamp: options.includeTimestamp ?? true,
      includeContext: options.includeContext ?? true,
      logDir: options.logDir !== undefined ? options.logDir : defaultDir,
      logFile: options.logFile || getDefaultLogFile(),
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB
    };

    if (this.options.logDir) {
      this.initLogFile();
    }
  }

  static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options);
    }
    return Logger.instance;
  }

  private initLogFile(): void {
    const dir = this.options.logDir!;
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this.logFilePath = join(dir, this.options.logFile);
    } catch {
      // If file logging fails, silently fall back to console only
      this.logFilePath = null;
    }
  }

  private rotateLogFileIfNeeded(): void {
    if (!this.logFilePath || !existsSync(this.logFilePath)) return;
    try {
      const stats = statSync(this.logFilePath);
      if (stats.size >= this.options.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const rotatedPath = this.logFilePath.replace(/\.log$/, `_${timestamp}.log`);
        renameSync(this.logFilePath, rotatedPath);
      }
    } catch {
      // ignore rotation errors
    }
  }

  private formatText(entry: LogEntry): string {
    const timestamp = this.options.includeTimestamp ? `[${entry.timestamp}] ` : "";
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const sourceStr = entry.source ? ` [${entry.source}]` : "";
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const errorStr = entry.error ? `\nError: ${entry.error.message}\n${entry.error.stack}` : "";
    return `${timestamp}${levelStr}${sourceStr}: ${entry.message}${contextStr}${errorStr}`;
  }

  private shouldLog(level: LogLevel): boolean {
    const levelOrder = {
      [LogLevel.ERROR]: 0,
      [LogLevel.WARN]: 1,
      [LogLevel.INFO]: 2,
      [LogLevel.DEBUG]: 3,
      [LogLevel.TRACE]: 4,
    };

    const currentLevel = levelOrder[this.options.level];
    const targetLevel = levelOrder[level];
    return targetLevel <= currentLevel;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.options.includeContext ? context : undefined,
      error,
      source: this.getCallerSource(),
    };
  }

  private getCallerSource(): string {
    const error = new Error();
    const stack = error.stack?.split("\n") || [];

    // Find first call stack that's not logger.ts
    for (let i = 3; i < stack.length; i++) {
      const line = stack[i].trim();
      if (!line.includes("logger.ts")) {
        const match = line.match(/at (.+?) \(/);
        if (match) {
          return match[1];
        }
        return line;
      }
    }

    return "unknown";
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Console output
    if (this.options.format === "json") {
      console.log(JSON.stringify(entry));
    } else {
      const message = this.formatText(entry);
      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(message);
          break;
        case LogLevel.WARN:
          console.warn(message);
          break;
        case LogLevel.INFO:
          console.info(message);
          break;
        case LogLevel.DEBUG:
          console.debug(message);
          break;
        default:
          console.log(message);
      }
    }

    // File output
    this.writeToFile(entry);
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.logFilePath) return;
    try {
      this.rotateLogFileIfNeeded();
      const line =
        this.options.format === "json"
          ? JSON.stringify(entry) + "\n"
          : this.formatText(entry) + "\n";
      appendFileSync(this.logFilePath, line);
    } catch {
      // Silently ignore file write failures to avoid crashing the app
    }
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.writeLog(this.createLogEntry(LogLevel.ERROR, message, context, error));
  }

  warn(message: string, context?: Record<string, any>): void {
    this.writeLog(this.createLogEntry(LogLevel.WARN, message, context));
  }

  info(message: string, context?: Record<string, any>): void {
    this.writeLog(this.createLogEntry(LogLevel.INFO, message, context));
  }

  debug(message: string, context?: Record<string, any>): void {
    this.writeLog(this.createLogEntry(LogLevel.DEBUG, message, context));
  }

  trace(message: string, context?: Record<string, any>): void {
    this.writeLog(this.createLogEntry(LogLevel.TRACE, message, context));
  }

  // Shortcut methods
  static error(message: string, context?: Record<string, any>, error?: Error): void {
    Logger.getInstance().error(message, context, error);
  }

  static warn(message: string, context?: Record<string, any>): void {
    Logger.getInstance().warn(message, context);
  }

  static info(message: string, context?: Record<string, any>): void {
    Logger.getInstance().info(message, context);
  }

  static debug(message: string, context?: Record<string, any>): void {
    Logger.getInstance().debug(message, context);
  }

  static trace(message: string, context?: Record<string, any>): void {
    Logger.getInstance().trace(message, context);
  }
}

// Export default instance
export const logger = Logger.getInstance();
