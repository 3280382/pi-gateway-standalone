/**
 * LLM Log Manager
 * Manages and persists LLM API request/response logs
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

    // Start periodic flush
    if (this.enabled) {
      this.startFlushInterval();
    }
  }

  /**
   * Set log file
   */
  setLogFile(sessionFile: string | undefined, sessionId: string): void {
    // Flush existing logs
    this.flush();

    this.currentSessionId = sessionId;
    if (sessionFile) {
      // Use same directory and base name as session file, but with .log extension
      this.logFilePath = sessionFile.replace(/\.jsonl$/, ".log");
    } else {
      this.logFilePath = null;
    }

    this.logger.info(
      `LLM log file set: sessionFile=${sessionFile}, logFilePath=${this.logFilePath}, enabled=${this.enabled}`
    );
  }

  /**
   * Log entry
   */
  log(entry: Omit<LlmLogEntry, "timestamp">): void {
    if (!this.enabled) {
      this.logger.debug(`LLM log entry skipped: enabled=false`);
      return;
    }

    const fullEntry: LlmLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.logBuffer.push(fullEntry);
    this.logger.debug(
      `LLM log entry: type=${entry.type}, bufferSize=${this.logBuffer.length}, logFilePath=${this.logFilePath}`
    );

    // If buffer is full, flush immediately
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Start periodic flush interval
   */
  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error("LLM log flush failed", {}, error instanceof Error ? error : undefined);
      });
    }, this.flushIntervalMs);
  }

  /**
   * Flush buffer to file
   */
  async flush(): Promise<void> {
    this.logger.debug(
      `LLM log flush: bufferLength=${this.logBuffer.length}, logFilePath=${this.logFilePath}`
    );

    if (this.logBuffer.length === 0 || !this.logFilePath) {
      this.logger.debug(
        `LLM log flush skipped: bufferEmpty=${this.logBuffer.length === 0}, noLogFile=${!this.logFilePath}`
      );
      return;
    }

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Ensure directory exists
      const dir = dirname(this.logFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Append to log file
      const lines = `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;
      await appendFile(this.logFilePath, lines, "utf-8");
      this.logger.info(
        `LLM log flush successful: wrote ${entries.length} entries to ${this.logFilePath}`
      );
    } catch (error) {
      this.logger.error("LLM log write failed", {}, error instanceof Error ? error : undefined);
      // Put entries back into buffer
      this.logBuffer.unshift(...entries);
    }
  }

  /**
   * Get log content
   */
  async getLogContent(): Promise<LlmLogEntry[]> {
    // First flush current buffer
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
      this.logger.error("LLM log read failed", {}, error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Set enabled status
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (enabled) {
      this.startFlushInterval();
    } else {
      // Clear buffer when disabled
      this.logBuffer = [];
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
        this.flushInterval = null;
      }
    }

    this.logger.info(`LLM logging enabled: ${enabled}`);
  }

  /**
   * Get enabled status
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get log file path
   */
  getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.logBuffer.length;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    this.flush().catch((error) => {
      this.logger.error(
        "LLM log final flush failed",
        {},
        error instanceof Error ? error : undefined
      );
    });
  }
}
