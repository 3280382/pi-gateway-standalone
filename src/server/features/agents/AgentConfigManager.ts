/**
 * Agent Config Manager — stores in /root/.pi/agent/agents.json
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { Logger, LogLevel } from "../../lib/utils/logger.js";
import type { AgentConfig } from "@shared/types/agent.types.js";

const logger = new Logger({ level: LogLevel.INFO });
const CONFIG_PATH = join(homedir(), ".pi", "agent", "agents.json");
const DEFAULT_TOOLS = ["read", "bash", "edit", "write"];

class AgentConfigManager {
  private agents: Record<string, AgentConfig> = {};
  private initialized = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  async init() {
    if (this.initialized) return;
    try {
      if (existsSync(CONFIG_PATH)) {
        const data = JSON.parse(await readFile(CONFIG_PATH, "utf-8"));
        this.agents = data.agents || {};
      } else {
        this.agents = {};
        await this.save();
      }
      this.initialized = true;
    } catch {
      this.agents = {};
      this.initialized = true;
    }
  }

  getAllAgents(): AgentConfig[] {
    return Object.values(this.agents).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getAgent(id: string) {
    return this.agents[id];
  }

  async createAgent(data: {
    name: string;
    description: string;
    systemPromptUseDefault?: boolean;
    systemPromptTemplate?: string;
    appendPromptUseDefault?: boolean;
    appendPromptTemplate?: string;
    contextUseDefault?: boolean;
    contextTemplate?: string;
    defaultModel: string;
    defaultProvider: string;
    thinkingLevel: AgentConfig["thinkingLevel"];
    tools?: string[];
    skillNames?: string[];
    promptTemplateNames?: string[];
  }): Promise<AgentConfig> {
    await this.init();
    const id = this.genId(data.name);
    const now = new Date().toISOString();
    const agent: AgentConfig = {
      id,
      name: data.name,
      description: data.description || "",
      systemPromptUseDefault: data.systemPromptUseDefault ?? true,
      systemPromptTemplate: data.systemPromptTemplate || "",
      appendPromptUseDefault: data.appendPromptUseDefault ?? true,
      appendPromptTemplate: data.appendPromptTemplate || "",
      contextUseDefault: data.contextUseDefault ?? true,
      contextTemplate: data.contextTemplate || "",
      defaultModel: data.defaultModel,
      defaultProvider: data.defaultProvider,
      thinkingLevel: data.thinkingLevel || "medium",
      tools: data.tools?.length ? data.tools : [...DEFAULT_TOOLS],
      skillNames: data.skillNames || [],
      promptTemplateNames: data.promptTemplateNames || [],
      createdAt: now,
      updatedAt: now,
    };
    this.agents[id] = agent;
    await this.debouncedSave();
    return agent;
  }

  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<AgentConfig | null> {
    await this.init();
    const existing = this.agents[id];
    if (!existing) return null;
    this.agents[id] = {
      ...existing,
      ...updates,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.debouncedSave();
    return this.agents[id];
  }

  async deleteAgent(id: string): Promise<boolean> {
    await this.init();
    if (!this.agents[id]) return false;
    delete this.agents[id];
    await this.debouncedSave();
    return true;
  }

  private genId(name: string) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30) +
      "-" +
      Date.now().toString(36).slice(-4)
    );
  }

  private debouncedSave(): Promise<void> {
    return new Promise((r) => {
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(async () => {
        await this.save();
        r();
      }, 300);
    });
  }

  private async save() {
    try {
      await writeFile(CONFIG_PATH, JSON.stringify({ agents: this.agents }, null, 2), "utf-8");
    } catch {}
  }
}

export const agentConfigManager = new AgentConfigManager();
