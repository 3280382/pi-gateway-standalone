/**
 * Session Config Manager
 *
 * Stores session configuration per working directory:
 *   /root/.pi/agent/sessions/{encoded-cwd}/session-config.json
 *
 * Each working directory has its own config file, keeping session
 * metadata co-located with session JSONL files.
 */

import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { Logger, LogLevel } from "../../../lib/utils/logger.js";

const logger = new Logger({ level: LogLevel.INFO });

const SESSIONS_ROOT = join(homedir(), ".pi", "agent", "sessions");

export interface SessionConfig {
  shortId: string;
  fullPath: string;
  workingDir: string;
  name: string;
  summary: string;
  agentId?: string;
  agentName?: string;
  parentId?: string | null;
  childIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionConfigMap {
  [shortId: string]: SessionConfig;
}

class SessionConfigManager {
  private configsByDir = new Map<string, SessionConfigMap>();
  private saveTimers = new Map<string, NodeJS.Timeout>();

  /** Encode working dir to safe directory name */
  private encodeCwd(cwd: string): string {
    return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  }

  private getConfigPath(workingDir: string): string {
    return join(SESSIONS_ROOT, this.encodeCwd(workingDir), "session-config.json");
  }

  /** Load config for a specific working directory */
  async loadDir(workingDir: string): Promise<SessionConfigMap> {
    if (this.configsByDir.has(workingDir)) return this.configsByDir.get(workingDir)!;

    const path = this.getConfigPath(workingDir);
    try {
      if (existsSync(path)) {
        const content = await readFile(path, "utf-8");
        const data = JSON.parse(content) as SessionConfigMap;
        this.configsByDir.set(workingDir, data);
        return data;
      }
    } catch {
      /* ignore corrupted files */
    }

    const empty: SessionConfigMap = {};
    this.configsByDir.set(workingDir, empty);
    return empty;
  }

  /** Get config for a specific session (searches all loaded dirs) */
  getConfig(shortId: string): SessionConfig | undefined {
    for (const configs of this.configsByDir.values()) {
      if (configs[shortId]) return configs[shortId];
    }
    return undefined;
  }

  /** Get all configs for a specific working directory */
  getAllConfigs(workingDir?: string): SessionConfigMap {
    if (workingDir) {
      return { ...(this.configsByDir.get(workingDir) || {}) };
    }
    // Merge all dirs (backward compat — only used in handleInit which should switch to per-dir)
    const merged: SessionConfigMap = {};
    for (const configs of this.configsByDir.values()) {
      Object.assign(merged, configs);
    }
    return merged;
  }

  private ensureEntry(
    dir: string,
    shortId: string,
    workingDir: string,
    fullPath = ""
  ): SessionConfig {
    const configs = this.configsByDir.get(dir)!;
    if (!configs[shortId]) {
      configs[shortId] = {
        shortId,
        fullPath,
        workingDir,
        name: "New Session",
        summary: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return configs[shortId];
  }

  async updateName(shortId: string, name: string, workingDir?: string): Promise<void> {
    const cfg = this.getConfig(shortId);
    if (!cfg) return;
    const wd = workingDir || cfg.workingDir;
    const dir = this.encodeCwd(wd);
    await this.loadDir(wd);
    const entry = this.ensureEntry(dir, shortId, wd, cfg.fullPath);
    entry.name = name;
    entry.updatedAt = new Date().toISOString();
    await this.debouncedSave(wd);
  }

  async setAgent(
    shortId: string,
    agentId: string,
    agentName: string,
    fullPath?: string,
    workingDir?: string
  ): Promise<void> {
    const wd = workingDir || this.getConfig(shortId)?.workingDir || process.cwd();
    const dir = this.encodeCwd(wd);
    await this.loadDir(wd);
    const entry = this.ensureEntry(dir, shortId, wd, fullPath || "");
    entry.agentId = agentId;
    entry.agentName = agentName;
    entry.updatedAt = new Date().toISOString();
    await this.debouncedSave(wd);
  }

  async addChild(parentId: string, childId: string): Promise<void> {
    const parentCfg = this.getConfig(parentId);
    if (!parentCfg) return;
    const wd = parentCfg.workingDir;
    const dir = this.encodeCwd(wd);
    await this.loadDir(wd);

    // Update parent
    const parent = this.ensureEntry(dir, parentId, wd, parentCfg.fullPath);
    const children = parent.childIds || [];
    if (!children.includes(childId)) {
      children.push(childId);
      parent.childIds = children;
    }
    parent.updatedAt = new Date().toISOString();

    // Create/update child
    const child = this.ensureEntry(dir, childId, wd);
    child.parentId = parentId;
    child.updatedAt = new Date().toISOString();

    await this.debouncedSave(wd);
  }

  getChildren(parentId: string): SessionConfig[] {
    for (const [, configs] of this.configsByDir) {
      const children = Object.values(configs).filter((c) => c.parentId === parentId);
      if (children.length > 0) return children;
    }
    return [];
  }

  getParent(childId: string): SessionConfig | undefined {
    const child = this.getConfig(childId);
    if (!child?.parentId) return undefined;
    return this.getConfig(child.parentId);
  }

  async autoInitialize(
    shortId: string,
    fullPath: string,
    workingDir: string
  ): Promise<SessionConfig | null> {
    const dir = this.encodeCwd(workingDir);
    await this.loadDir(workingDir);
    const configs = this.configsByDir.get(workingDir)!;
    if (configs[shortId]) return configs[shortId];

    const summary = await this.extractSummary(fullPath);
    const name = this.defaultName(summary);
    configs[shortId] = {
      shortId,
      fullPath,
      workingDir,
      name,
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.debouncedSave(workingDir);
    return configs[shortId];
  }

  async ensureConfigs(
    sessions: Array<{ id: string; path: string }>,
    workingDir: string
  ): Promise<void> {
    const dir = this.encodeCwd(workingDir);
    await this.loadDir(workingDir);
    const configs = this.configsByDir.get(workingDir)!;
    const missing = sessions.filter((s) => !configs[s.id]);
    if (missing.length === 0) return;

    for (const s of missing) {
      await this.autoInitialize(s.id, s.path, workingDir);
    }
  }

  // ========== Persistence ==========

  private async debouncedSave(workingDir: string): Promise<void> {
    const timerKey = workingDir;
    if (this.saveTimers.has(timerKey)) clearTimeout(this.saveTimers.get(timerKey)!);
    return new Promise<void>((resolve) => {
      this.saveTimers.set(
        timerKey,
        setTimeout(async () => {
          this.saveTimers.delete(timerKey);
          await this.save(workingDir);
          resolve();
        }, 500)
      );
    });
  }

  private async save(workingDir: string): Promise<void> {
    const configs = this.configsByDir.get(workingDir);
    if (!configs || Object.keys(configs).length === 0) return;
    const path = this.getConfigPath(workingDir);
    try {
      mkdirSync(join(path, ".."), { recursive: true });
      await writeFile(path, JSON.stringify(configs, null, 2), "utf-8");
    } catch (error) {
      logger.error(`[SessionConfigManager] Save failed for ${workingDir}: ${error}`);
    }
  }

  // ========== Helpers ==========

  private async extractSummary(fullPath: string): Promise<string> {
    try {
      if (!existsSync(fullPath)) return "";
      const { open } = await import("node:fs/promises");
      const handle = await open(fullPath, "r");
      const buffer = Buffer.alloc(10240);
      const { bytesRead } = await handle.read(buffer, 0, 10240, 0);
      await handle.close();
      const lines = buffer
        .toString("utf-8", 0, bytesRead)
        .split("\n")
        .filter((l) => l.trim());
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === "message" && entry.message?.role === "user") {
            const content = entry.message.content;
            let prompt = "";
            if (Array.isArray(content)) {
              prompt = content
                .filter((c: any) => c.type === "text")
                .map((c: any) => c.text)
                .join(" ");
            } else if (typeof content === "string") prompt = content;
            return prompt.slice(0, 100) + (prompt.length > 100 ? "..." : "");
          }
        } catch {}
      }
    } catch {}
    return "";
  }

  private defaultName(prompt: string): string {
    if (!prompt) return "New Session";
    const firstLine = prompt.split("\n")[0].trim();
    return firstLine.slice(0, 30) + (firstLine.length > 30 ? "..." : "") || "New Session";
  }
}

export const sessionConfigManager = new SessionConfigManager();
