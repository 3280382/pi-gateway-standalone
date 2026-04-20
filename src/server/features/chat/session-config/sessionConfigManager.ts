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
import { Logger, LogLevel } from "../../../lib/utils/logger";

const logger = new Logger({ level: LogLevel.INFO });

const CONFIG_PATH = "/root/.pi/agent/sessions.json";

export interface SessionConfig {
  shortId: string;
  fullPath: string;
  workingDir: string;
  name: string;
  summary: string;
  firstUserPrompt?: string;
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
        logger.info(`[SessionConfigManager] Loaded ${Object.keys(this.config).length} session configs`);
      } else {
        this.config = {};
        await this.save();
        logger.info("[SessionConfigManager] Created new sessions.json");
      }
      this.initialized = true;
    } catch (error) {
      logger.error("[SessionConfigManager] Failed to init:", error);
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
  async autoInitialize(shortId: string, fullPath: string, workingDir: string): Promise<SessionConfig> {
    await this.init();
    
    // Already exists
    if (this.config[shortId]) {
      return this.config[shortId];
    }

    // Extract info from JSONL
    const { firstUserPrompt, summary } = await this.extractFromJSONL(fullPath);
    
    // Generate default name from first prompt
    const defaultName = this.generateDefaultName(firstUserPrompt);
    
    const config: SessionConfig = {
      shortId,
      fullPath,
      workingDir,
      name: defaultName,
      summary,
      firstUserPrompt,
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
  async ensureConfigs(sessions: Array<{ id: string; path: string }>, workingDir: string): Promise<void> {
    await this.init();
    
    let hasNew = false;
    for (const session of sessions) {
      if (!this.config[session.id]) {
        await this.autoInitialize(session.id, session.path, workingDir);
        hasNew = true;
      }
    }
    
    if (hasNew) {
      await this.debouncedSave();
    }
  }

  /**
   * Extract first user prompt and generate summary from JSONL
   */
  private async extractFromJSONL(fullPath: string): Promise<{ firstUserPrompt: string; summary: string }> {
    try {
      if (!existsSync(fullPath)) {
        return { firstUserPrompt: "", summary: "" };
      }

      const content = await readFile(fullPath, "utf-8");
      const lines = content.split("\n").filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Look for first user message
          if (entry.type === "message" && entry.message?.role === "user") {
            const content = entry.message.content;
            let prompt = "";
            
            if (Array.isArray(content)) {
              // Extract text from content array
              prompt = content
                .filter((c: any) => c.type === "text")
                .map((c: any) => c.text)
                .join(" ");
            } else if (typeof content === "string") {
              prompt = content;
            }
            
            // Generate summary (first 100 chars)
            const summary = prompt.slice(0, 100) + (prompt.length > 100 ? "..." : "");
            
            return { firstUserPrompt: prompt, summary };
          }
        } catch {
          // Skip invalid lines
          continue;
        }
      }
      
      return { firstUserPrompt: "", summary: "" };
    } catch (error) {
      logger.error(`[SessionConfigManager] Failed to extract from ${fullPath}:`, error);
      return { firstUserPrompt: "", summary: "" };
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
      logger.error("[SessionConfigManager] Failed to save:", error);
    }
  }
}

// Singleton instance
export const sessionConfigManager = new SessionConfigManager();
