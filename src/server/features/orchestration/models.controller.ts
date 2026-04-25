/**
 * Models Controller - Read/write models.json with automatic backup
 */
import type { Request, Response } from "express";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HOME = process.env.HOME || "/root";
const MODELS_JSON = join(HOME, ".pi", "agent", "models.json");
const BACKUP_DIR = join(HOME, ".pi", "agent", "backups");

function ensureBackupDir() {
  mkdirSync(BACKUP_DIR, { recursive: true });
}
function backupFile(ts = Date.now()) {
  ensureBackupDir();
  if (!existsSync(MODELS_JSON)) return;
  const dest = join(BACKUP_DIR, `models.json.${ts}.bak`);
  copyFileSync(MODELS_JSON, dest);
  console.log(`[Models] Backed up to ${dest}`);
}

export async function getRawModels(_req: Request, res: Response) {
  try {
    if (!existsSync(MODELS_JSON)) {
      res.json({ content: "{}" });
      return;
    }
    const content = await readFile(MODELS_JSON, "utf-8");
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

export async function saveRawModels(req: Request, res: Response) {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: "Content required" });
      return;
    }

    // Validate JSON
    try {
      JSON.parse(content);
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    // Backup before save
    backupFile(Date.now());

    await writeFile(MODELS_JSON, content, "utf-8");
    res.json({ success: true, backedUp: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

export async function deleteModel(req: Request, res: Response) {
  try {
    const { provider, modelId } = req.params;
    const content = await readFile(MODELS_JSON, "utf-8");
    const config = JSON.parse(content);

    if (!config.providers?.[provider]?.models) {
      res.status(404).json({ error: "Provider or model not found" });
      return;
    }

    const models = config.providers[provider].models;
    const idx = models.findIndex((m: any) => m.id === modelId);
    if (idx < 0) {
      res.status(404).json({ error: "Model not found" });
      return;
    }

    backupFile(Date.now());
    models.splice(idx, 1);
    if (models.length === 0) delete config.providers[provider];

    await writeFile(MODELS_JSON, JSON.stringify(config, null, 2), "utf-8");
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

export async function addModel(req: Request, res: Response) {
  try {
    const { provider, modelId, name, contextWindow } = req.body;
    if (!provider || !modelId) {
      res.status(400).json({ error: "Provider and modelId required" });
      return;
    }

    const content = await readFile(MODELS_JSON, "utf-8");
    const config = JSON.parse(content);
    config.providers = config.providers || {};
    config.providers[provider] = config.providers[provider] || { models: [] };

    // Check duplicate
    if (config.providers[provider].models.some((m: any) => m.id === modelId)) {
      res.status(409).json({ error: "Model already exists" });
      return;
    }

    backupFile(Date.now());
    config.providers[provider].models.push({
      id: modelId,
      name: name || modelId,
      contextWindow: contextWindow || 0,
    });
    config.providers[provider].models.sort((a: any, b: any) => a.id.localeCompare(b.id));

    await writeFile(MODELS_JSON, JSON.stringify(config, null, 2), "utf-8");
    res.status(201).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

export async function listBackups(_req: Request, res: Response) {
  try {
    ensureBackupDir();
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(BACKUP_DIR))
      .filter((f) => f.startsWith("models.json.") && f.endsWith(".bak"))
      .sort()
      .reverse()
      .slice(0, 20);
    res.json({ backups: files });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

export async function restoreBackup(req: Request, res: Response) {
  try {
    const { file } = req.params;
    const backupPath = join(BACKUP_DIR, file);
    if (!existsSync(backupPath)) {
      res.status(404).json({ error: "Backup not found" });
      return;
    }

    // Backup current before restore
    backupFile(Date.now());
    const content = await readFile(backupPath, "utf-8");
    await writeFile(MODELS_JSON, content, "utf-8");
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
