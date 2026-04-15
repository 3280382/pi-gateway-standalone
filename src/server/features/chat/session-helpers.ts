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
 * 获取工作目录下的所有 session 文件列表
 */
export async function getAllSessions(workingDir: string): Promise<
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

    logger.info(`[getAllSessions] Found ${sessions.length} sessions for ${workingDir}`);

    return sessions.map((s) => ({
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
 */
export async function getSessionMessages(sessionFile: string): Promise<any[]> {
  try {
    if (!existsSync(sessionFile)) {
      return [];
    }
    const content = await readFile(sessionFile, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    return lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (e) {
    logger.error(`[getSessionMessages] Failed: ${e}`);
    return [];
  }
}

/**
 * 构建统一的初始化/切换响应
 *
 * 用于：
 * - init.ts 的 initialized 响应
 * - change-dir.ts 的 dir_changed 响应
 */
export async function buildSessionResponse(
  session: PiAgentSession,
  workingDir: string
): Promise<{
  pid: number;
  workingDir: string;
  currentSession: {
    sessionId: string;
    sessionFile: string;
    messages: any[];
  };
  allSessions: Awaited<ReturnType<typeof getAllSessions>>;
  currentModel: string | null;
  allModels: Awaited<ReturnType<typeof getAllModels>>;
  thinkingLevel: string;
}> {
  // 获取 session 信息
  // 统一使用完整路径作为 sessionId（与 sessionFile 一致）
  const sessionFile = session.session?.sessionFile || "";
  const sessionId = sessionFile; // 使用完整路径作为 ID，而不是 UUID
  const sessionMessages = await getSessionMessages(sessionFile);

  // 并行获取其他数据
  const [allSessions, allModels] = await Promise.all([getAllSessions(workingDir), getAllModels()]);

  return {
    pid: process.pid,
    workingDir,
    currentSession: {
      sessionId,
      sessionFile,
      messages: sessionMessages,
    },
    allSessions,
    currentModel: session.session?.model?.id || null,
    allModels,
    thinkingLevel: session.session?.thinkingLevel || "off",
  };
}
