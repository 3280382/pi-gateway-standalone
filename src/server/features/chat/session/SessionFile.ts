/**
 * Session Helpers - Shared session utilities
 *
 * These functions shared by WebSocket handlers and HTTP controllers
 * - getAllSessions: Get all session file lists in working directory
 * - getAllModels: Get model list
 * - getSessionMessages: Read session file content (SERVER-SIDE PROCESSED)
 * - buildInitResponse: Build unified initialization response
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import type {
  Message,
  SessionMessagesResponse,
} from "../../../../shared/types/session-messages.types.js";
import { Logger, LogLevel } from "../../../lib/utils/logger.js";
import type { PiAgentSession } from "../agent-session/piAgentSession.js";
import { extractShortSessionId, serverSessionManager } from "../agent-session/session-manager.js";
import { getLocalSessionsDir } from "./utils.js";
import { sessionConfigManager } from "./SessionConfig.js";
import { processSessionEntries } from "../session-processor.js";

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
    status?: string;
    hasClient?: boolean;
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

    logger.info(
      `[getAllSessions] Found ${sortedSessions.length} sessions, returning ${limitedSessions.length} for ${workingDir}`
    );

    // 【性能优化】获取运行时状态（与广播逻辑一致）
    const activeSessions = serverSessionManager.getAllSessions();
    const activeSessionMap = new Map(
      activeSessions.map((s) => [extractShortSessionId(s.sessionFile), s])
    );

    // Ensure configs exist for top sessions and get all configs
    const sessionIds = limitedSessions.map((s) => ({
      id: extractShortSessionId(s.path),
      path: s.path,
    }));
    await sessionConfigManager.ensureConfigs(sessionIds, workingDir);
    const configs = sessionConfigManager.getAllConfigs();

    return limitedSessions.map((s) => {
      const shortId = extractShortSessionId(s.path);
      const config = configs[shortId];
      const activeInfo = activeSessionMap.get(shortId);

      return {
        id: s.path,
        path: s.path,
        // 【一致性保障】与 handleListSessions 使用相同的 name 生成逻辑
        name:
          config?.name || s.firstMessage?.slice(0, 35) || s.path?.split("/").pop() || "Untitled",
        messageCount: s.messageCount || 0,
        lastModified: s.modified.toISOString(),
        // 【状态一致性】从 serverSessionManager 获取 runtime status
        status: activeInfo?.runtimeStatus || "history",
        hasClient: activeInfo ? activeInfo.hasClient : false,
      };
    });
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
 * Read session file content (JSONL) - SERVER-SIDE PROCESSED
 *
 * 【性能优化】服务器端直接处理消息，返回标准化的 Message 数组
 * 避免客户端进行昂贵的 normalizeSessionMessages 操作
 *
 * @param sessionFile Session file path
 * @param limit Maximum number of messages to return (from the end), -1 for all
 * @param offset Number of messages to skip from the end (for pagination)
 * @returns SessionMessagesResponse with pre-processed messages
 */
export async function getSessionMessages(
  sessionFile: string,
  limit?: number,
  offset?: number
): Promise<SessionMessagesResponse> {
  const startTime = Date.now();

  try {
    if (!existsSync(sessionFile)) {
      return {
        messages: [],
        totalCount: 0,
        processed: true,
        sessionFile,
      };
    }

    // Read file content
    const content = await readFile(sessionFile, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    // Parse all entries
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const totalCount = entries.length;

    // Apply pagination (from the end)
    let paginatedEntries;
    if (limit !== undefined || offset !== undefined) {
      const actualOffset = offset || 0;
      // limit = -1 means load all remaining messages
      const actualLimit = limit === -1 ? entries.length : limit || entries.length;
      const startIndex = Math.max(0, entries.length - actualOffset - actualLimit);
      const endIndex = Math.max(0, entries.length - actualOffset);
      paginatedEntries = entries.slice(startIndex, endIndex);
    } else {
      paginatedEntries = entries;
    }

    // 【关键优化】服务器端处理消息，转换为标准格式
    const { messages } = processSessionEntries(paginatedEntries);

    const duration = Date.now() - startTime;
    logger.info(
      `[getSessionMessages] Processed ${messages.length} messages in ${duration}ms (total: ${totalCount})`
    );

    return {
      messages,
      totalCount,
      processed: true, // Mark as server-processed
      sessionFile,
      pagination: {
        offset: offset || 0,
        limit: limit || messages.length,
        hasMore: (offset || 0) + messages.length < totalCount,
      },
    };
  } catch (e) {
    logger.error(`[getSessionMessages] Failed: ${e}`);
    return {
      messages: [],
      totalCount: 0,
      processed: true,
      sessionFile,
      error: e instanceof Error ? e.message : String(e),
    };
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
    // Use raw entries for model detection (don't need full processing)
    if (!existsSync(sessionFile)) {
      return null;
    }
    const content = await readFile(sessionFile, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Search backwards for last model_change
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "model_change" && entry.provider && entry.modelId) {
        logger.info(`[getSessionModel] Found session model: ${entry.provider}/${entry.modelId}`);
        return {
          provider: entry.provider,
          modelId: entry.modelId,
          fullId: `${entry.provider}/${entry.modelId}`,
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
    // Use raw entries for model detection
    if (!existsSync(sessionFile)) {
      return defaultModel || null;
    }
    const content = await readFile(sessionFile, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Search backwards for last model_change
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "model_change" && (entry.model || entry.modelId)) {
        const modelId = entry.model || entry.modelId;
        const provider = entry.provider || "";
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
 * Build unified Session response
 * Used for:
 * - init.ts initialized response
 * - change-dir.ts dir_changed response
 * - load_session response
 *
 * 【优化】返回服务器预处理的消息，客户端无需再执行 normalizeSessionMessages
 */
export async function buildSessionResponse(
  session: PiAgentSession,
  workingDir: string,
  messageLimit: number = 100,
  sessionLimit: number = 15,
  explicitSessionFile?: string
): Promise<{
  pid: number;
  workingDir: string;
  currentSession: {
    sessionId: string;
    sessionFile: string;
    messages: Message[]; // Pre-processed messages
    totalMessageCount: number;
    processed: boolean;
  };
  allSessions: Awaited<ReturnType<typeof getAllSessions>>;
  currentModel: string | null;
  defaultModel: string | null;
  allModels: Awaited<ReturnType<typeof getAllModels>>;
  thinkingLevel: string;
}> {
  const buildStart = Date.now();

  // Get session info: prioritize explicit path，otherwise get from session object
  const sessionFile = explicitSessionFile || session.session?.sessionFile || "";
  const sessionId = sessionFile;

  logger.info(`[buildSessionResponse] Building response for: ${sessionFile}`);

  // 【关键优化】使用新的 getSessionMessages 获取预处理的消息
  const [messagesResponse, totalMessageCount] = await Promise.all([
    getSessionMessages(sessionFile, messageLimit),
    getSessionMessageCount(sessionFile),
  ]);

  let sessionMessages = messagesResponse.messages;
  logger.info(
    `[buildSessionResponse] Loaded ${sessionMessages.length} pre-processed messages in ${Date.now() - buildStart}ms`
  );

  // Merge buffered messages (if any)- achieve seamless connection
  // Messages produced when session runs in background are buffered，need to merge with file messages
  const bufferedMessages = session.getBufferedMessages ? session.getBufferedMessages() : [];
  if (bufferedMessages.length > 0) {
    // Process buffered messages
    const { messages: processedBuffered } = processSessionEntries(bufferedMessages);
    sessionMessages = [...sessionMessages, ...processedBuffered];
    logger.info(`[buildSessionResponse] Merged ${bufferedMessages.length} buffered messages`);
  }

  // Get default model (from settings.json)
  const defaultModel = session.session?.model?.id || null;

  // Get current actual model（priority: read from session, else use default）
  const currentModel = await getSessionCurrentModel(sessionFile, defaultModel);

  // Fetch other data in parallel
  const [allSessions, allModels] = await Promise.all([
    getAllSessions(workingDir, sessionLimit),
    getAllModels(),
  ]);

  const totalDuration = Date.now() - buildStart;
  logger.info(`[buildSessionResponse] Complete in ${totalDuration}ms`);

  return {
    pid: process.pid,
    workingDir,
    currentSession: {
      sessionId,
      sessionFile,
      messages: sessionMessages,
      totalMessageCount,
      processed: true, // Mark as server-processed
    },
    allSessions,
    currentModel,
    defaultModel,
    allModels,
    thinkingLevel: session.session?.thinkingLevel || "off",
  };
}
