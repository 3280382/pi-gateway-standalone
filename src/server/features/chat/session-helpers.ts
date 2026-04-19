/**
 * Session Helpers - Shared session utilities
 *
 * These functions shared by WebSocket handlers and HTTP controllers
 * - getAllSessions: Get all session file lists in working directory
 * - getAllModels: Get model list
 * - getSessionMessages: Read session file content
 * - buildInitResponse: Build unified initialization response
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { Logger, LogLevel } from "../../lib/utils/logger";
import { getLocalSessionsDir } from "./agent-session/utils";
import type { PiAgentSession } from "./agent-session/piAgentSession";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Get session file list in working directory
 * @param workingDir Working directory
 * @param limit Max return count (default: all)
 * @returns Session list (sorted by modification time, newest first)
 */
export async function getAllSessions(
  workingDir: string,
  limit?: number
): Promise<
  Array<{
    id: string;
    path: string;
    name: string;
    messageCount: number;
    lastModified: string;
  }>
> {
  try {
    const localSessionsDir = getLocalSessionsDir(workingDir);
    const sessions = await SessionManager.list(workingDir, localSessionsDir);

    // Sort by modification time (newest first)
    const sortedSessions = sessions.sort(
      (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
    );

    // Apply pagination limit
    const limitedSessions = limit ? sortedSessions.slice(0, limit) : sortedSessions;

    logger.info(`[getAllSessions] Found ${sortedSessions.length} sessions, returning ${limitedSessions.length} for ${workingDir}`);

    return limitedSessions.map((s) => ({
      id: s.path,
      path: s.path,
      name: s.firstMessage?.slice(0, 35) || s.path?.split("/").pop() || "Untitled",
      messageCount: s.messageCount || 0,
      lastModified: s.modified.toISOString(),
    }));
  } catch (e) {
    logger.error(`[getAllSessions] Failed: ${e}`);
    return [];
  }
}

/**
 * Get model list
 */
export async function getAllModels(): Promise<
  Array<{
    id: string;
    name: string;
    provider?: string;
    maxTokens?: number;
    contextWindow?: number;
    reasoning?: boolean;
    input?: string[];
  }>
> {
  try {
    const modelsJsonPath = "/root/.pi/agent/models.json";
    const content = await readFile(modelsJsonPath, "utf-8").catch(() => "{}");
    const config = JSON.parse(content);

    const models: any[] = [];
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
              maxTokens: model.maxTokens || 0,
              reasoning: model.reasoning || false,
              input: model.input || ["text"],
            });
          }
        }
      }
    }
    return models;
  } catch (e) {
    logger.error(`[getAllModels] Failed: ${e}`);
    return [];
  }
}

/**
 * Read session file content (JSONL)
 * @param sessionFile Session file path
 * @param limit Maximum number of messages to return (from the end)
 * @param offset Number of messages to skip from the end (for pagination)
 * @returns Array of messages
 */
export async function getSessionMessages(
  sessionFile: string,
  limit?: number,
  offset?: number
): Promise<any[]> {
  try {
    if (!existsSync(sessionFile)) {
      return [];
    }
    const content = await readFile(sessionFile, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    const messages = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Apply pagination (from the end)
    // limit: -1 means load all messages
    if (limit !== undefined || offset !== undefined) {
      const actualOffset = offset || 0;
      // limit = -1 means load all remaining messages
      const actualLimit = limit === -1 ? messages.length : (limit || messages.length);
      const startIndex = Math.max(0, messages.length - actualOffset - actualLimit);
      const endIndex = Math.max(0, messages.length - actualOffset);
      return messages.slice(startIndex, endIndex);
    }

    return messages;
  } catch (e) {
    logger.error(`[getSessionMessages] Failed: ${e}`);
    return [];
  }
}

/**
 * Get total message count
 */
export async function getSessionMessageCount(sessionFile: string): Promise<number> {
  try {
    if (!existsSync(sessionFile)) {
      return 0;
    }
    const content = await readFile(sessionFile, "utf-8");
    return content.split("\n").filter((line) => line.trim()).length;
  } catch (e) {
    logger.error(`[getSessionMessageCount] Failed: ${e}`);
    return 0;
  }
}

/**
 * Get Session-level model settings
 * Find last model_change entry from session file
 * @returns sessionModel: { provider: string, modelId: string } | null
 */
export async function getSessionModel(sessionFile: string): Promise<{
  provider: string;
  modelId: string;
  fullId: string;
} | null> {
  try {
    const messages = await getSessionMessages(sessionFile);

    // Search backwards for last model_change
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.type === "model_change" && msg.provider && msg.modelId) {
        logger.info(`[getSessionModel] Found session model: ${msg.provider}/${msg.modelId}`);
        return {
          provider: msg.provider,
          modelId: msg.modelId,
          fullId: `${msg.provider}/${msg.modelId}`,
        };
      }
    }

    logger.info(`[getSessionModel] No model_change found in session`);
    return null;
  } catch (e) {
    logger.error(`[getSessionModel] Failed: ${e}`);
    return null;
  }
}

/**
 * Get current model used by Session
 * Priority: read last model_change from session JSONL
 * If not found, use default model from settings.json
 */
export async function getSessionCurrentModel(
  sessionFile: string,
  defaultModel?: string | null
): Promise<string | null> {
  try {
    const messages = await getSessionMessages(sessionFile);

    // Search backwards for last model_change
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.type === "model_change" && (msg.model || msg.modelId)) {
        const modelId = msg.model || msg.modelId;
        const provider = msg.provider || "";
        const fullId = provider ? `${provider}/${modelId}` : modelId;
        logger.info(`[getSessionCurrentModel] Found session model: ${fullId}`);
        return fullId;
      }
    }

    // No model_change in Session, use default
    if (defaultModel) {
      logger.info(`[getSessionCurrentModel] Using default model: ${defaultModel}`);
      return defaultModel;
    }

    return null;
  } catch (e) {
    logger.error(`[getSessionCurrentModel] Failed: ${e}`);
    return defaultModel || null;
  }
}

/**
 * Build unified initialization/switch response
 *
 * Used for:
 * - init.ts initialized response
 * - change-dir.ts dir_changed response
 */
/**
 * Build unified Session response
 * Used for:
 * - init.ts initialized response
 * - change-dir.ts dir_changed response
 *
 * Optimizations:
 * - Default: only load recent 100 messages
 * - allSessions default: only load recent 10
 */
export async function buildSessionResponse(
  session: PiAgentSession,
  workingDir: string,
  messageLimit: number = 100,
  sessionLimit: number = 10,
  explicitSessionFile?: string  // Optional: explicitly specify sessionFile（used after switchSession）
): Promise<{
  pid: number;
  workingDir: string;
  currentSession: {
    sessionId: string;
    sessionFile: string;
    messages: any[];
    totalMessageCount: number;
  };
  allSessions: Awaited<ReturnType<typeof getAllSessions>>;
  currentModel: string | null;
  defaultModel: string | null;
  allModels: Awaited<ReturnType<typeof getAllModels>>;
  thinkingLevel: string;
}> {
  // Get session info: prioritize explicit path，otherwise get from session object
  const sessionFile = explicitSessionFile || session.session?.sessionFile || "";
  const sessionId = sessionFile;

  logger.info(`[buildSessionResponse] Loading messages for: ${sessionFile}, explicit: ${explicitSessionFile || 'none'}`);

  // Get total message count and recent messages（Optimizations:只加载最近 100 条）
  const [fileMessages, totalMessageCount] = await Promise.all([
    getSessionMessages(sessionFile, messageLimit),
    getSessionMessageCount(sessionFile),
  ]);

  logger.info(`[buildSessionResponse] Loaded ${fileMessages.length} messages (total: ${totalMessageCount})`);

  // Merge buffered messages (if any)- achieve seamless connection
  // Messages produced when session runs in background are buffered，need to merge with file messages
  const bufferedMessages = session.getBufferedMessages ? session.getBufferedMessages() : [];
  const sessionMessages = bufferedMessages.length > 0
    ? [...fileMessages, ...bufferedMessages]
    : fileMessages;

  // Get default model (from settings.json)
  const defaultModel = session.session?.model?.id || null;

  // Get current actual model（priority: read from session, else use default）
  const currentModel = await getSessionCurrentModel(sessionFile, defaultModel);

  // Fetch other data in parallel (Optimizations:only load recent 10 sessions)）
  const [allSessions, allModels] = await Promise.all([
    getAllSessions(workingDir, sessionLimit),
    getAllModels(),
  ]);

  return {
    pid: process.pid,
    workingDir,
    currentSession: {
      sessionId,
      sessionFile,
      messages: sessionMessages,
      totalMessageCount,
    },
    allSessions,
    currentModel,
    defaultModel,
    allModels,
    thinkingLevel: session.session?.thinkingLevel || "off",
  };
}
