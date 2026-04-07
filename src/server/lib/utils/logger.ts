/**
 * Logger utility
 * Provides structured logging functionality
 */

import { LogLevel } from "../../../shared/types/common.types";

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
}

export class Logger {
	private static instance: Logger;
	private options: LoggerOptions;

	constructor(options: LoggerOptions = {}) {
		this.options = {
			level: options.level || LogLevel.INFO,
			format: options.format || "text",
			includeTimestamp: options.includeTimestamp ?? true,
			includeContext: options.includeContext ?? true,
		};
	}

	static getInstance(options?: LoggerOptions): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger(options);
		}
		return Logger.instance;
	}

	private shouldLog(level: LogLevel): boolean {
		const levelOrder = {
			[LogLevel.ERROR]: 0,
			[LogLevel.WARN]: 1,
			[LogLevel.INFO]: 2,
			[LogLevel.DEBUG]: 3,
			[LogLevel.TRACE]: 4,
		};

		const currentLevel = levelOrder[this.options.level!];
		const targetLevel = levelOrder[level];
		return targetLevel <= currentLevel;
	}

	private createLogEntry(
		level: LogLevel,
		message: string,
		context?: Record<string, any>,
		error?: Error,
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

		if (this.options.format === "json") {
			console.log(JSON.stringify(entry));
		} else {
			const timestamp = this.options.includeTimestamp
				? `[${entry.timestamp}] `
				: "";
			const levelStr = entry.level.toUpperCase().padEnd(5);
			const sourceStr = entry.source ? ` [${entry.source}]` : "";
			const contextStr = entry.context
				? ` ${JSON.stringify(entry.context)}`
				: "";
			const errorStr = entry.error
				? `\nError: ${entry.error.message}\n${entry.error.stack}`
				: "";

			const message = `${timestamp}${levelStr}${sourceStr}: ${entry.message}${contextStr}${errorStr}`;

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
	static error(
		message: string,
		context?: Record<string, any>,
		error?: Error,
	): void {
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
