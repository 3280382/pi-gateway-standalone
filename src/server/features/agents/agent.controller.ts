/**
 * Agent HTTP Controller
 * Handles CRUD + model/template/skill listing
 */

import type { Request, Response } from "express";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { agentConfigManager } from "./AgentConfigManager.js";

// ========== Model Listing ==========

export async function listModels(_req: Request, res: Response): Promise<void> {
  try {
    const modelsJsonPath = "/root/.pi/agent/models.json";
    if (!existsSync(modelsJsonPath)) {
      res.json({ models: [] });
      return;
    }
    const content = await readFile(modelsJsonPath, "utf-8");
    const config = JSON.parse(content);
    const models: Array<{
      id: string;
      provider: string;
      name: string;
      contextWindow?: number;
    }> = [];

    if (config.providers) {
      for (const [providerName, providerConfig] of Object.entries(config.providers)) {
        const provider = providerConfig as any;
        if (provider.models && Array.isArray(provider.models)) {
          for (const model of provider.models) {
            models.push({
              id: `${providerName}/${model.id}`,
              provider: providerName,
              name: model.name || model.id,
              contextWindow: model.contextWindow || 0,
            });
          }
        }
      }
    }
    res.json({ models });
  } catch (error) {
    console.error("[AgentController] List models error:", error);
    res.status(500).json({ error: "Failed to list models" });
  }
}

// ========== Template Listing ==========

export async function listTemplates(req: Request, res: Response): Promise<void> {
  try {
    const templates: Array<{ name: string; path: string; source: string; content?: string }> = [];

    // Global: ~/.pi/agent/prompts/
    const home = process.env.HOME || "/root";
    const globalDir = join(home, ".pi", "agent", "prompts");
    if (existsSync(globalDir)) {
      const files = await readdir(globalDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          templates.push({
            name: file.replace(".md", ""),
            path: join(globalDir, file),
            source: "global",
          });
        }
      }
    }

    // Local: workingDir/.pi/prompts/
    const workingDir = (req.query.workingDir as string) || process.cwd();
    const localDir = join(workingDir, ".pi", "prompts");
    if (existsSync(localDir)) {
      const files = await readdir(localDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          templates.push({
            name: file.replace(".md", ""),
            path: join(localDir, file),
            source: "local",
          });
        }
      }
    }

    // Optionally read content for a specific template
    const name = req.query.name as string | undefined;
    if (name) {
      const tpl = templates.find((t) => t.name === name);
      if (tpl) {
        tpl.content = await readFile(tpl.path, "utf-8");
      }
    }

    templates.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ templates });
  } catch (error) {
    console.error("[AgentController] List templates error:", error);
    res.status(500).json({ error: "Failed to list templates" });
  }
}

// ========== Skill Listing ==========

export async function listSkills(_req: Request, res: Response): Promise<void> {
  try {
    const skills: Array<{ name: string; description: string; path: string; source: string }> = [];

    const home = process.env.HOME || "/root";

    async function scanDir(dir: string, source: string) {
      if (!existsSync(dir)) return;
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const skillMd = join(dir, entry.name, "SKILL.md");
          if (!existsSync(skillMd)) continue;

          const content = await readFile(skillMd, "utf-8");
          // Parse YAML frontmatter for description
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          let description = "";
          if (fmMatch) {
            const descMatch = fmMatch[1].match(/description:\s*(.+)/);
            if (descMatch) description = descMatch[1].trim();
          }
          skills.push({
            name: entry.name,
            description,
            path: skillMd,
            source,
          });
        }
      } catch {
        /* ignore */
      }
    }

    await scanDir(join(home, ".pi", "agent", "skills"), "global");
    await scanDir(join(process.cwd(), ".pi", "skills"), "local");

    skills.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ skills });
  } catch (error) {
    console.error("[AgentController] List skills error:", error);
    res.status(500).json({ error: "Failed to list skills" });
  }
}

// ========== Agent CRUD ==========

export async function listAgents(_req: Request, res: Response): Promise<void> {
  try {
    await agentConfigManager.init();
    res.json({ agents: agentConfigManager.getAllAgents() });
  } catch (error) {
    res.status(500).json({ error: "Failed to list agents" });
  }
}

export async function getAgent(req: Request, res: Response): Promise<void> {
  try {
    await agentConfigManager.init();
    const agent = agentConfigManager.getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({ agent });
  } catch (error) {
    res.status(500).json({ error: "Failed to get agent" });
  }
}

export async function createAgent(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      description,
      defaultModel,
      defaultProvider,
      thinkingLevel,
      tools,
      skillNames,
      promptTemplateNames,
      systemPromptUseDefault,
      systemPromptTemplate,
      appendPromptUseDefault,
      appendPromptTemplate,
      contextUseDefault,
      contextTemplate,
    } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "Name required" });
      return;
    }
    if (!defaultModel || !defaultProvider) {
      res.status(400).json({ error: "Model and provider required" });
      return;
    }

    const agent = await agentConfigManager.createAgent({
      name: name.trim(),
      description: description?.trim() || "",
      systemPromptUseDefault: systemPromptUseDefault ?? true,
      systemPromptTemplate: systemPromptTemplate || "",
      appendPromptUseDefault: appendPromptUseDefault ?? true,
      appendPromptTemplate: appendPromptTemplate || "",
      contextUseDefault: contextUseDefault ?? true,
      contextTemplate: contextTemplate || "",
      defaultModel: defaultModel.trim(),
      defaultProvider: defaultProvider.trim(),
      thinkingLevel: thinkingLevel || "medium",
      tools,
      skillNames,
      promptTemplateNames,
    });

    res.status(201).json({ agent });
  } catch (error) {
    console.error("[AgentController] Create error:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
}

export async function updateAgent(req: Request, res: Response): Promise<void> {
  try {
    const agent = await agentConfigManager.updateAgent(req.params.id, req.body);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({ agent });
  } catch (error) {
    res.status(500).json({ error: "Failed to update agent" });
  }
}

export async function deleteAgent(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await agentConfigManager.deleteAgent(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete agent" });
  }
}
