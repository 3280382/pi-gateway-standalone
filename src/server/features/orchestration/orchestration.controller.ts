/**
 * Orchestration Controller
 * Manages prompts, skills, models, and workflows for the orchestration feature
 */

import type { Request, Response } from "express";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HOME = process.env.HOME || "/root";
const GLOBAL_PROMPTS = join(HOME, ".pi", "agent", "prompts");
const GLOBAL_SKILLS = join(HOME, ".pi", "agent", "skills");
const MODELS_JSON = join(HOME, ".pi", "agent", "models.json");
const WORKFLOWS_JSON = join(HOME, ".pi", "agent", "workflows.json");

// ========== Helpers ==========

async function readJson(path: string): Promise<any> {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return {};
  }
}
async function writeJson(path: string, data: any): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

function getWorkingDir(req: Request): string {
  return (req.query.workingDir as string) || process.cwd();
}

// ========== Prompts ==========

export async function listPrompts(req: Request, res: Response) {
  const prompts: Array<{ name: string; path: string; source: string }> = [];
  async function scan(dir: string, source: string) {
    if (!existsSync(dir)) return;
    for (const f of await readdir(dir)) {
      if (f.endsWith(".md"))
        prompts.push({ name: f.replace(".md", ""), path: join(dir, f), source });
    }
  }
  await scan(GLOBAL_PROMPTS, "global");
  await scan(join(getWorkingDir(req), ".pi", "prompts"), "local");
  prompts.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ prompts });
}

export async function getPrompt(req: Request, res: Response) {
  const { name } = req.params;
  const wd = getWorkingDir(req);
  const candidates = [join(GLOBAL_PROMPTS, `${name}.md`), join(wd, ".pi", "prompts", `${name}.md`)];
  for (const p of candidates) {
    if (existsSync(p)) {
      res.json({ name, path: p, content: await readFile(p, "utf-8") });
      return;
    }
  }
  res.status(404).json({ error: "Prompt not found" });
}

export async function createPrompt(req: Request, res: Response) {
  const { name, content } = req.body;
  if (!name?.trim() || !content?.trim()) {
    res.status(400).json({ error: "Name and content required" });
    return;
  }
  mkdirSync(GLOBAL_PROMPTS, { recursive: true });
  const path = join(GLOBAL_PROMPTS, `${name.trim()}.md`);
  if (existsSync(path)) {
    res.status(409).json({ error: "Prompt already exists" });
    return;
  }
  await writeFile(path, content.trim(), "utf-8");
  res.status(201).json({ name: name.trim(), path, content: content.trim() });
}

export async function updatePrompt(req: Request, res: Response) {
  const { name } = req.params;
  const { content } = req.body;
  const wd = getWorkingDir(req);
  const candidates = [join(GLOBAL_PROMPTS, `${name}.md`), join(wd, ".pi", "prompts", `${name}.md`)];
  for (const p of candidates) {
    if (existsSync(p)) {
      await writeFile(p, content, "utf-8");
      res.json({ name, path: p, content });
      return;
    }
  }
  res.status(404).json({ error: "Prompt not found" });
}

export async function deletePrompt(req: Request, res: Response) {
  const { name } = req.params;
  const wd = getWorkingDir(req);
  const candidates = [join(GLOBAL_PROMPTS, `${name}.md`), join(wd, ".pi", "prompts", `${name}.md`)];
  for (const p of candidates) {
    if (existsSync(p)) {
      unlinkSync(p);
      res.json({ success: true });
      return;
    }
  }
  res.status(404).json({ error: "Prompt not found" });
}

// ========== Skills ==========

export async function listSkills(req: Request, res: Response) {
  const skills: Array<{ name: string; description: string; path: string }> = [];
  if (existsSync(GLOBAL_SKILLS)) {
    for (const entry of await readdir(GLOBAL_SKILLS, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = join(GLOBAL_SKILLS, entry.name, "SKILL.md");
      if (!existsSync(skillMd)) continue;
      const content = await readFile(skillMd, "utf-8");
      const fm = content.match(/^---\n([\s\S]*?)\n---/);
      let desc = "";
      if (fm) {
        const m = fm[1].match(/description:\s*(.+)/);
        if (m) desc = m[1].trim();
      }
      skills.push({ name: entry.name, description: desc, path: skillMd });
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ skills });
}

export async function getSkill(req: Request, res: Response) {
  const { name } = req.params;
  const skillMd = join(GLOBAL_SKILLS, name, "SKILL.md");
  if (!existsSync(skillMd)) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }
  res.json({ name, path: skillMd, content: await readFile(skillMd, "utf-8") });
}

export async function createSkill(req: Request, res: Response) {
  const { name, content } = req.body;
  if (!name?.trim() || !content?.trim()) {
    res.status(400).json({ error: "Name and content required" });
    return;
  }
  const dir = join(GLOBAL_SKILLS, name.trim());
  if (existsSync(dir)) {
    res.status(409).json({ error: "Skill already exists" });
    return;
  }
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "SKILL.md");
  await writeFile(path, content.trim(), "utf-8");
  res.status(201).json({ name: name.trim(), path, content: content.trim() });
}

export async function updateSkill(req: Request, res: Response) {
  const { name } = req.params;
  const { content } = req.body;
  const skillMd = join(GLOBAL_SKILLS, name, "SKILL.md");
  if (!existsSync(skillMd)) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }
  await writeFile(skillMd, content, "utf-8");
  res.json({ name, path: skillMd, content });
}

export async function deleteSkill(req: Request, res: Response) {
  const { name } = req.params;
  const dir = join(GLOBAL_SKILLS, name);
  if (!existsSync(dir)) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }
  const { rmdir } = await import("node:fs/promises");
  await rmdir(dir, { recursive: true });
  res.json({ success: true });
}

// ========== Models ==========

export async function listOrchModels(_req: Request, res: Response) {
  try {
    const config = await readJson(MODELS_JSON);
    const models: Array<{ id: string; provider: string; name: string; contextWindow?: number }> =
      [];
    if (config.providers) {
      for (const [provider, pc] of Object.entries(config.providers)) {
        const p = pc as any;
        if (p.models)
          for (const m of p.models)
            models.push({
              id: `${provider}/${m.id}`,
              provider,
              name: m.name || m.id,
              contextWindow: m.contextWindow,
            });
      }
    }
    res.json({ models });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
}

// ========== Workflows ==========

export async function listWorkflows(_req: Request, res: Response) {
  const data = await readJson(WORKFLOWS_JSON);
  const workflows = Object.values(data.workflows || {}) as any[];
  workflows.sort(
    (a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  res.json({ workflows });
}

export async function createWorkflow(req: Request, res: Response) {
  const {
    name,
    description,
    agentId,
    skillNames = [],
    promptTemplateNames = [],
    workingDir,
  } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Name required" });
    return;
  }
  const data = await readJson(WORKFLOWS_JSON);
  data.workflows = data.workflows || {};
  const id =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30) +
    "-" +
    Date.now().toString(36).slice(-4);
  const now = new Date().toISOString();
  data.workflows[id] = {
    id,
    name: name.trim(),
    description: description || "",
    agentId: agentId || "",
    skillNames,
    promptTemplateNames,
    workingDir: workingDir || "",
    createdAt: now,
    updatedAt: now,
  };
  await writeJson(WORKFLOWS_JSON, data);
  res.status(201).json({ workflow: data.workflows[id] });
}

export async function updateWorkflow(req: Request, res: Response) {
  const data = await readJson(WORKFLOWS_JSON);
  if (!data.workflows?.[req.params.id]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  Object.assign(data.workflows[req.params.id], req.body, { updatedAt: new Date().toISOString() });
  await writeJson(WORKFLOWS_JSON, data);
  res.json({ workflow: data.workflows[req.params.id] });
}

export async function deleteWorkflow(req: Request, res: Response) {
  const data = await readJson(WORKFLOWS_JSON);
  if (!data.workflows?.[req.params.id]) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  delete data.workflows[req.params.id];
  await writeJson(WORKFLOWS_JSON, data);
  res.json({ success: true });
}
