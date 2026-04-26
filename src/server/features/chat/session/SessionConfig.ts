/**
 * Session Config Manager
 *
 * Stores session configuration per working directory:
 *   /root/.pi/agent/sessions/{encoded-cwd}/session-config.json
 *
 * File format (simplified):
 * {
 *   "_meta": { "workingDir": "/path" },
 *   "shortId1": { "fullPath": "...", "name": "...", "agentId": "...", "agentName": "...", "parentId": "...", "childIds": [] },
 *   "shortId2": { "fullPath": "...", "name": "..." }
 * }
 *
 * Note: fullPath is kept per-session because each session has a unique JSONL file.
 * workingDir is stored once in _meta since all sessions in one file share it.
 */

import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { Logger, LogLevel } from "../../../lib/utils/logger.js";

const logger = new Logger({ level: LogLevel.INFO });

const SESSIONS_ROOT = join(homedir(), ".pi", "agent", "sessions");

/** Per-session config (minimal, only fields actually used) */
export interface SessionConfig {
  fullPath: string;
  name: string;
  agentId?: string;
  agentName?: string;
  parentId?: string | null;
  childIds?: string[];
}

/** In-memory representation: sessionId -> SessionConfig */
export interface SessionConfigMap {
  [shortId: string]: SessionConfig;
}

/** Raw file content includes _meta header */
interface RawConfigFile {
  _meta?: { workingDir: string };
  [shortId: string]: unknown;
}

class SessionConfigManager {
  private configsByDir = new Map<string, SessionConfigMap>();

  /** Encode working dir to safe directory name */
  private encodeCwd(cwd: string): string {
    return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  }

  private getConfigPath(workingDir: string): string {
    return join(SESSIONS_ROOT, this.encodeCwd(workingDir), "session-config.json");
  }

  /** Normalize an old-format entry to new format */
  private normalizeEntry(entry: Record<string, unknown>): SessionConfig {
    const fullPath = (entry.fullPath as string) || "";
    const name = (entry.name as string) || "New Session";
    const result: SessionConfig = { fullPath, name };
    if (entry.agentId) result.agentId = entry.agentId as string;
    if (entry.agentName) result.agentName = entry.agentName as string;
    if (entry.parentId != null) result.parentId = entry.parentId as string | null;
    if (entry.childIds) result.childIds = entry.childIds as string[];
    return result;
  }

  /** Load config for a specific working directory */
  async loadDir(workingDir: string): Promise<SessionConfigMap> {
    if (this.configsByDir.has(workingDir)) return this.configsByDir.get(workingDir)!;

    const path = this.getConfigPath(workingDir);
    try {
      if (existsSync(path)) {
        const content = await readFile(path, "utf-8");
        const raw = JSON.parse(content) as RawConfigFile;

        const map: SessionConfigMap = {};
        for (const [key, value] of Object.entries(raw)) {
          if (key === "_meta") continue;
          if (value && typeof value === "object") {
            map[key] = this.normalizeEntry(value as Record<string, unknown>);
          }
        }
        this.configsByDir.set(workingDir, map);
        return map;
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
    const merged: SessionConfigMap = {};
    for (const configs of this.configsByDir.values()) {
      Object.assign(merged, configs);
    }
    return merged;
  }

  private ensureEntry(configs: SessionConfigMap, shortId: string, fullPath: string): SessionConfig {
    if (!configs[shortId]) {
      configs[shortId] = { fullPath, name: "New Session" };
    }
    return configs[shortId];
  }

  async updateName(shortId: string, name: string, workingDir?: string): Promise<void> {
    const cfg = this.getConfig(shortId);
    if (!cfg) return;
    const wd = workingDir || this.resolveWorkingDir(shortId);
    if (!wd) return;
    await this.loadDir(wd);
    const configs = this.configsByDir.get(wd)!;
    const entry = this.ensureEntry(configs, shortId, cfg.fullPath);
    entry.name = name;
    await this.debouncedSave(wd);
  }

  async setAgent(
    shortId: string,
    agentId: string,
    agentName: string,
    fullPath?: string,
    workingDir?: string
  ): Promise<void> {
    const wd = workingDir || this.resolveWorkingDir(shortId) || process.cwd();
    await this.loadDir(wd);
    const configs = this.configsByDir.get(wd)!;
    const entry = this.ensureEntry(
      configs,
      shortId,
      fullPath || this.getConfig(shortId)?.fullPath || ""
    );
    entry.agentId = agentId;
    entry.agentName = agentName;
    await this.debouncedSave(wd);
  }

  async addChild(parentId: string, childId: string, parentWorkingDir?: string): Promise<void> {
    const wd = parentWorkingDir || this.resolveWorkingDir(parentId);
    if (!wd) return;
    await this.loadDir(wd);
    const configs = this.configsByDir.get(wd)!;

    // Update parent
    const parentCfg = this.getConfig(parentId);
    const parent = this.ensureEntry(configs, parentId, parentCfg?.fullPath || "");
    const children = parent.childIds || [];
    if (!children.includes(childId)) {
      children.push(childId);
      parent.childIds = children;
    }

    // Create/update child
    const childCfg = this.getConfig(childId);
    const child = this.ensureEntry(configs, childId, childCfg?.fullPath || "");
    child.parentId = parentId;

    await this.debouncedSave(wd);
  }

  getChildren(parentId: string): SessionConfig[] {
    for (const configs of this.configsByDir.values()) {
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

  async removeConfig(shortId: string, workingDir?: string): Promise<void> {
    const cfg = this.getConfig(shortId);
    if (!cfg) return;
    const wd = workingDir || this.resolveWorkingDir(shortId);
    if (!wd) return;
    await this.loadDir(wd);
    const configs = this.configsByDir.get(wd);
    if (!configs) return;
    delete configs[shortId];
    await this.debouncedSave(wd);
  }

  async autoInitialize(
    shortId: string,
    fullPath: string,
    workingDir: string
  ): Promise<SessionConfig | null> {
    await this.loadDir(workingDir);
    const configs = this.configsByDir.get(workingDir)!;
    if (configs[shortId]) return configs[shortId];

    const name = await this.inferName(fullPath);
    configs[shortId] = { fullPath, name };
    await this.debouncedSave(workingDir);
    return configs[shortId];
  }

  async ensureConfigs(
    sessions: Array<{ id: string; path: string }>,
    workingDir: string
  ): Promise<void> {
    await this.loadDir(workingDir);
    const configs = this.configsByDir.get(workingDir)!;
    const missing = sessions.filter((s) => !configs[s.id]);
    if (missing.length === 0) return;

    for (const s of missing) {
      await this.autoInitialize(s.id, s.path, workingDir);
    }
  }

  /** Try to find which workingDir a shortId belongs to */
  private resolveWorkingDir(shortId: string): string | undefined {
    for (const [wd, configs] of this.configsByDir) {
      if (configs[shortId]) return wd;
    }
    return undefined;
  }

  // ========== Persistence ==========

  private async debouncedSave(workingDir: string): Promise<void> {
    // Config operations are infrequent (sub-agent creation, name updates)
    // and the file is tiny (a few KB). Writing directly is simpler and
    // avoids the Promise-hanging bug that debounce timers introduce.
    await this.save(workingDir);
  }

  private async save(workingDir: string): Promise<void> {
    const configs = this.configsByDir.get(workingDir);
    if (!configs || Object.keys(configs).length === 0) return;
    const path = this.getConfigPath(workingDir);
    try {
      mkdirSync(join(path, ".."), { recursive: true });
      const payload: Record<string, unknown> = {
        _meta: { workingDir },
      };
      for (const [shortId, config] of Object.entries(configs)) {
        const entry: Record<string, unknown> = {};
        if (config.fullPath) entry.fullPath = config.fullPath;
        if (config.name) entry.name = config.name;
        if (config.agentId) entry.agentId = config.agentId;
        if (config.agentName) entry.agentName = config.agentName;
        if (config.parentId != null) entry.parentId = config.parentId;
        if (config.childIds?.length) entry.childIds = config.childIds;
        payload[shortId] = entry;
      }
      await writeFile(path, JSON.stringify(payload, null, 2), "utf-8");
    } catch (error) {
      logger.error(`[SessionConfigManager] Save failed for ${workingDir}: ${error}`);
    }
  }

  // ========== Helpers ==========

  private async inferName(fullPath: string): Promise<string> {
    try {
      if (!existsSync(fullPath)) return "New Session";
      const { open } = await import("node:fs/promises");
      const handle = await open(fullPath, "r");
      const buffer = Buffer.alloc(4096);
      const { bytesRead } = await handle.read(buffer, 0, 4096, 0);
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
            const firstLine = prompt.split("\n")[0].trim();
            return firstLine.slice(0, 30) + (firstLine.length > 30 ? "..." : "") || "New Session";
          }
        } catch {}
      }
    } catch {}
    return "New Session";
  }
}

export const sessionConfigManager = new SessionConfigManager();
