/**
 * Session Config Manager
 *
 * Manages static session configuration in /root/.pi/agent/sessions.json
 * - Stores: workingDir, shortId, fullPath, name, summary
 * - Extracts name/summary from first user prompt in JSONL
 * - Auto-initializes config for new sessions
 * - Provides API for updating session metadata
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { Logger, LogLevel } from "../../../lib/utils/logger.js";

const logger = new Logger({ level: LogLevel.INFO });

const CONFIG_PATH = "/root/.pi/agent/sessions.json";

export interface SessionConfig {
  shortId: string;
  fullPath: string;
  workingDir: string;
  name: string;
  summary: string;
  // 【性能优化】不再保存 firstUserPrompt，避免 sessions.json 文件过大
  // firstUserPrompt 只在需要时从 JSONL 文件实时读取
  createdAt: string;
  updatedAt: string;
}

export interface SessionConfigMap {
  [shortId: string]: SessionConfig;
}

class SessionConfigManager {
  private config: SessionConfigMap = {};
  private initialized = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  /**
   * Initialize and load config from disk
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      if (existsSync(CONFIG_PATH)) {
        const content = await readFile(CONFIG_PATH, "utf-8");
        this.config = JSON.parse(content);
        logger.info(
          `[SessionConfigManager] Loaded ${Object.keys(this.config).length} session configs`
        );
      } else {
        this.config = {};
        await this.save();
        logger.info("[SessionConfigManager] Created new sessions.json");
      }
      this.initialized = true;
    } catch (error) {
      logger.error(`[SessionConfigManager] Failed to init: ${error}`);
      this.config = {};
      this.initialized = true;
    }
  }

  /**
   * Get config for a session
   */
  getConfig(shortId: string): SessionConfig | undefined {
    return this.config[shortId];
  }

  /**
   * Get all configs
   */
  getAllConfigs(): SessionConfigMap {
    return { ...this.config };
  }

  /**
   * Update session name
   */
  async updateName(shortId: string, name: string): Promise<void> {
    await this.init();

    if (this.config[shortId]) {
      this.config[shortId].name = name;
      this.config[shortId].updatedAt = new Date().toISOString();
      await this.debouncedSave();
      logger.info(`[SessionConfigManager] Updated name for ${shortId}: ${name}`);
    }
  }

  /**
   * Auto-initialize config from session file
   */
  async autoInitialize(
    shortId: string,
    fullPath: string,
    workingDir: string
  ): Promise<SessionConfig | null> {
    await this.init();

    // Already exists - return existing without logging
    if (this.config[shortId]) {
      return this.config[shortId];
    }

    // Extract info from JSONL（只获取summary，不保存firstUserPrompt）
    const { summary } = await this.extractFromJSONL(fullPath);

    // Generate default name from first prompt
    const defaultName = this.generateDefaultName(summary);

    const config: SessionConfig = {
      shortId,
      fullPath,
      workingDir,
      name: defaultName,
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.config[shortId] = config;
    await this.debouncedSave();

    logger.info(`[SessionConfigManager] Auto-initialized ${shortId}: ${defaultName}`);
    return config;
  }

  /**
   * Ensure all sessions have config entries
   * Call this when broadcasting sessions to auto-init any missing sessions
   */
  async ensureConfigs(
    sessions: Array<{ id: string; path: string }>,
    workingDir: string
  ): Promise<void> {
    await this.init();

    // Quick check: count missing configs first
    const missingSessions = sessions.filter((s) => !this.config[s.id]);
    if (missingSessions.length === 0) {
      // All sessions already have configs, skip processing
      return;
    }

    logger.info(
      `[SessionConfigManager] Found ${missingSessions.length} new sessions to initialize`
    );

    let hasNew = false;
    for (const session of missingSessions) {
      await this.autoInitialize(session.id, session.path, workingDir);
      hasNew = true;
    }

    if (hasNew) {
      await this.debouncedSave();
    }
  }

  /**
   * Extract summary from JSONL（只读取前几条，避免大文件）
   * 【性能优化】不返回完整 firstUserPrompt，只返回 summary
   */
  private async extractFromJSONL(fullPath: string): Promise<{ summary: string }> {
    try {
      if (!existsSync(fullPath)) {
        return { summary: "" };
      }

      // 【性能优化】只读取文件前 10KB，避免大文件
      const { readFile } = await import("node:fs/promises");
      const fd = await import("node:fs");
      const handle = await fd.promises.open(fullPath, "r");
      const buffer = Buffer.alloc(10240); // 10KB
      const { bytesRead } = await handle.read(buffer, 0, 10240, 0);
      await handle.close();

      const content = buffer.toString("utf-8", 0, bytesRead);
      const lines = content.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Look for first user message
          if (entry.type === "message" && entry.message?.role === "user") {
            const msgContent = entry.message.content;
            let prompt = "";

            if (Array.isArray(msgContent)) {
              // Extract text from content array
              prompt = msgContent
                .filter((c: any) => c.type === "text")
                .map((c: any) => c.text)
                .join(" ");
            } else if (typeof msgContent === "string") {
              prompt = msgContent;
            }

            // Generate summary (first 100 chars)
            const summary = prompt.slice(0, 100) + (prompt.length > 100 ? "..." : "");

            return { summary };
          }
        } catch {}
      }

      return { summary: "" };
    } catch (error) {
      logger.error(`[SessionConfigManager] Failed to extract from ${fullPath}: ${error}`);
      return { summary: "" };
    }
  }

  /**
   * Generate default name from first prompt
   */
  private generateDefaultName(prompt: string): string {
    if (!prompt) return "New Session";

    // Extract first line or first 30 chars
    const firstLine = prompt.split("\n")[0].trim();
    const shortName = firstLine.slice(0, 30) + (firstLine.length > 30 ? "..." : "");

    return shortName || "New Session";
  }

  /**
   * Save config to disk (debounced)
   */
  private debouncedSave(): Promise<void> {
    return new Promise((resolve) => {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }

      this.saveTimeout = setTimeout(async () => {
        await this.save();
        resolve();
      }, 500);
    });
  }

  /**
   * Save config to disk immediately
   */
  private async save(): Promise<void> {
    try {
      await writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 2), "utf-8");
    } catch (error) {
      logger.error(`[SessionConfigManager] Failed to save: ${error}`);
    }
  }
}

// Singleton instance
export const sessionConfigManager = new SessionConfigManager();
