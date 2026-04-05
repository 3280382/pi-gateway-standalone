/**
 * LLM日志管理器
 * 管理和持久化LLM API请求/响应日志
 */

import { existsSync, mkdirSync } from "node:fs";
import { appendFile, readFile } from "node:fs/promises";
import * as path from "node:path";

const { dirname } = path;

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { LlmLogEntry, LlmLogOptions } from "./types";

export class LlmLogManager {
	private enabled: boolean;
	private logFilePath: string | null = null;
	private currentSessionId: string | null = null;
	private logBuffer: LlmLogEntry[] = [];
	private flushInterval: NodeJS.Timeout | null = null;
	private maxBufferSize: number;
	private flushIntervalMs: number;
	private logger: Logger;

	constructor(options: LlmLogOptions = {}) {
		this.enabled = options.enabled ?? true;
		this.maxBufferSize = options.maxBufferSize ?? 100;
		this.flushIntervalMs = options.flushInterval ?? 5000;
		this.logger = new Logger({ level: LogLevel.INFO });

		// 启动定期刷新
		if (this.enabled) {
			this.startFlushInterval();
		}
	}

	/**
	 * 设置日志文件
	 */
	setLogFile(sessionFile: string | undefined, sessionId: string): void {
		// 刷新现有日志
		this.flush();

		this.currentSessionId = sessionId;
		if (sessionFile) {
			// 使用与会话文件相同的目录和基本名称，但使用.log扩展名
			this.logFilePath = sessionFile.replace(/\.jsonl$/, ".log");
		} else {
			this.logFilePath = null;
		}

		this.logger.info(
			`LLM日志文件设置: sessionFile=${sessionFile}, logFilePath=${this.logFilePath}, enabled=${this.enabled}`,
		);
	}

	/**
	 * 记录日志条目
	 */
	log(entry: Omit<LlmLogEntry, "timestamp">): void {
		if (!this.enabled) {
			this.logger.debug(`LLM日志记录跳过: enabled=false`);
			return;
		}

		const fullEntry: LlmLogEntry = {
			...entry,
			timestamp: new Date().toISOString(),
		};

		this.logBuffer.push(fullEntry);
		this.logger.debug(
			`LLM日志记录: type=${entry.type}, bufferSize=${this.logBuffer.length}, logFilePath=${this.logFilePath}`,
		);

		// 如果缓冲区已满，立即刷新
		if (this.logBuffer.length >= this.maxBufferSize) {
			this.flush();
		}
	}

	/**
	 * 启动定期刷新间隔
	 */
	private startFlushInterval(): void {
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
		}

		this.flushInterval = setInterval(() => {
			this.flush().catch((error) => {
				this.logger.error(
					"LLM日志刷新失败",
					{},
					error instanceof Error ? error : undefined,
				);
			});
		}, this.flushIntervalMs);
	}

	/**
	 * 刷新缓冲区到文件
	 */
	async flush(): Promise<void> {
		this.logger.debug(
			`LLM日志刷新: bufferLength=${this.logBuffer.length}, logFilePath=${this.logFilePath}`,
		);

		if (this.logBuffer.length === 0 || !this.logFilePath) {
			this.logger.debug(
				`LLM日志刷新跳过: bufferEmpty=${this.logBuffer.length === 0}, noLogFile=${!this.logFilePath}`,
			);
			return;
		}

		const entries = [...this.logBuffer];
		this.logBuffer = [];

		try {
			// 确保目录存在
			const dir = dirname(this.logFilePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			// 追加到日志文件
			const lines = `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;
			await appendFile(this.logFilePath, lines, "utf-8");
			this.logger.info(
				`LLM日志刷新成功: 写入${entries.length}个条目到${this.logFilePath}`,
			);
		} catch (error) {
			this.logger.error(
				"LLM日志写入失败",
				{},
				error instanceof Error ? error : undefined,
			);
			// 将条目放回缓冲区
			this.logBuffer.unshift(...entries);
		}
	}

	/**
	 * 获取日志内容
	 */
	async getLogContent(): Promise<LlmLogEntry[]> {
		// 首先刷新当前缓冲区
		await this.flush();

		if (!this.logFilePath || !existsSync(this.logFilePath)) {
			return [];
		}

		try {
			const content = await readFile(this.logFilePath, "utf-8");
			const lines = content
				.trim()
				.split("\n")
				.filter((l) => l.trim());
			return lines.map((line) => JSON.parse(line));
		} catch (error) {
			this.logger.error(
				"LLM日志读取失败",
				{},
				error instanceof Error ? error : undefined,
			);
			return [];
		}
	}

	/**
	 * 设置启用状态
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;

		if (enabled) {
			this.startFlushInterval();
		} else {
			// 禁用时清空缓冲区
			this.logBuffer = [];
			if (this.flushInterval) {
				clearInterval(this.flushInterval);
				this.flushInterval = null;
			}
		}

		this.logger.info(`LLM日志启用状态: ${enabled}`);
	}

	/**
	 * 获取启用状态
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * 获取当前会话ID
	 */
	getCurrentSessionId(): string | null {
		return this.currentSessionId;
	}

	/**
	 * 获取日志文件路径
	 */
	getLogFilePath(): string | null {
		return this.logFilePath;
	}

	/**
	 * 获取缓冲区大小
	 */
	getBufferSize(): number {
		return this.logBuffer.length;
	}

	/**
	 * 清理资源
	 */
	dispose(): void {
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}

		// 最终刷新
		this.flush().catch((error) => {
			this.logger.error(
				"LLM日志最终刷新失败",
				{},
				error instanceof Error ? error : undefined,
			);
		});
	}
}
