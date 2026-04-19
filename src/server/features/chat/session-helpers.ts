/**
 * Session Helpers - 共享的 Session 辅助函数
 *
 * 这些函数被多个 WebSocket handlers 和 HTTP controllers 共享
 * - getAllSessions: 获取工作目录下的所有 session 文件列表
 * - getAllModels: 获取模型列表
 * - getSessionMessages: 读取 session 文件内容
 * - buildInitResponse: 构建统一的初始化响应
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { Logger, LogLevel } from "../../lib/utils/logger";
import { getLocalSessionsDir } from "./agent-session/utils";
import type { PiAgentSession } from "./agent-session/piAgentSession";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 获取工作目录下的 session 文件列表
 * @param workingDir 工作目录
 * @param limit 最大返回数量（默认返回所有）
 * @returns Session 列表（按最后修改时间排序，最新的在前）
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

    // 按最后修改时间排序（最新的在前）
    const sortedSessions = sessions.sort(
      (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
    );

    // 应用分页限制
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
 * 获取模型列表
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
 * 读取 session 文件内容（JSONL）
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
 * 获取消息总数
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
 * 获取 Session 级别的模型设置
 * 从 session 文件中查找最后一次 model_change entry
 * @returns sessionModel: { provider: string, modelId: string } | null
 */
export async function getSessionModel(sessionFile: string): Promise<{
  provider: string;
  modelId: string;
  fullId: string;
} | null> {
  try {
    const messages = await getSessionMessages(sessionFile);

    // 从后向前查找最后一次 model_change
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
 * 获取 Session 当前使用的模型
 * 优先从 session JSONL 文件中读取最后一次 model_change
 * 如果没有则使用 settings.json 的默认模型
 */
export async function getSessionCurrentModel(
  sessionFile: string,
  defaultModel?: string | null
): Promise<string | null> {
  try {
    const messages = await getSessionMessages(sessionFile);

    // 从后向前查找最后一次 model_change
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

    // Session 中没有 model_change，使用默认模型
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
 * 构建统一的初始化/切换响应
 *
 * 用于：
 * - init.ts 的 initialized 响应
 * - change-dir.ts 的 dir_changed 响应
 */
/**
 * 构建统一的 Session 响应
 * 用于：
 * - init.ts 的 initialized 响应
 * - change-dir.ts 的 dir_changed 响应
 *
 * 优化：
 * - 默认只加载最近 100 条消息
 * - allSessions 默认只加载最近 10 个
 */
export async function buildSessionResponse(
  session: PiAgentSession,
  workingDir: string,
  messageLimit: number = 100,
  sessionLimit: number = 10,
  explicitSessionFile?: string  // 可选：明确指定 sessionFile（用于 switchSession 后）
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
  // 获取 session 信息：优先使用明确指定的路径，否则从 session 对象获取
  const sessionFile = explicitSessionFile || session.session?.sessionFile || "";
  const sessionId = sessionFile;

  logger.info(`[buildSessionResponse] Loading messages for: ${sessionFile}, explicit: ${explicitSessionFile || 'none'}`);

  // 获取消息总数和最近的消息（优化：只加载最近 100 条）
  const [fileMessages, totalMessageCount] = await Promise.all([
    getSessionMessages(sessionFile, messageLimit),
    getSessionMessageCount(sessionFile),
  ]);

  logger.info(`[buildSessionResponse] Loaded ${fileMessages.length} messages (total: ${totalMessageCount})`);

  // 合并缓冲区消息（如果有）- 实现无缝衔接
  // 当 session 在后台运行时产生的消息会被缓冲，需要与文件消息合并
  const bufferedMessages = session.getBufferedMessages ? session.getBufferedMessages() : [];
  const sessionMessages = bufferedMessages.length > 0
    ? [...fileMessages, ...bufferedMessages]
    : fileMessages;

  // 获取默认模型（来自 settings.json）
  const defaultModel = session.session?.model?.id || null;

  // 获取当前实际使用的模型（优先从 session 中读取，否则使用默认）
  const currentModel = await getSessionCurrentModel(sessionFile, defaultModel);

  // 并行获取其他数据（优化：只加载最近 10 个 session）
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
