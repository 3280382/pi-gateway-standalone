/**
 * Model Controller
 * Handles model-related API requests
 */

import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { Request, Response } from "express";
import { Logger, LogLevel } from "../../../lib/utils/logger";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Get available models list
 */
export async function getModels(_req: Request, res: Response) {
  try {
    const authStorage = AuthStorage.create();
    const modelRegistry = new ModelRegistry(authStorage);
    const available = await modelRegistry.getAvailable();

    logger.info(`Retrieved model list, count: ${available.length}`);
    // Debug: log first model to check id type
    if (available.length > 0) {
      logger.info(
        `First model: id=${JSON.stringify(available[0].id)}, typeof id=${typeof available[0].id}`
      );
    }
    const models = available.map((m) => ({
      id: typeof m.id === "object" ? (m.id as any).id || String(m.id) : m.id,
      provider: m.provider,
      name: m.name ?? (typeof m.id === "object" ? String(m.id) : m.id),
      description: "",
      // Complete model parameters
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      reasoning: m.reasoning,
      input: m.input,
      cost: m.cost,
      compat: m.compat,
    }));
    res.json({ models });
  } catch (error) {
    logger.error(
      `Error retrieving model list: ${error instanceof Error ? error.message : String(error)}`
    );
    res.status(500).json({ error: String(error) });
  }
}
