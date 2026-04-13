/**
 * Init Message Handler
 * 
 * 架构：
 * - 客户端发送 workingDir（从 localStorage 获取）
 * - 服务器根据 workingDir 决定：
 *   1. 如果服务器已有相同 workingDir 的 session → 重新关联，重新监听事件
 *   2. 如果服务器没有该 workingDir 的 session → 创建新的
 *   3. 如果服务器有 session 但 workingDir 不同 → 结束旧的，创建新的
 * - 服务器返回完整数据供客户端恢复界面
 * 
 * 返回数据：
 * - pid: 服务器 PID
 * - workingDir: 当前工作目录
 * - currentSession: { sessionId, sessionFile, messages }
 * - allSessions: 该工作目录下的所有 session 文件列表
 * - currentModel: 当前模型
 * - allModels: 所有可用模型列表
 * - thinkingLevel: 思考级别
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { Logger, LogLevel } from "../../../../lib/utils/logger";
import { serverSessionManager } from "../../agent-session/session-manager";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { getLocalSessionsDir } from "../../agent-session/utils";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 获取工作目录下的所有 session 文件列表
 */
async function getAllSessions(workingDir: string): Promise<Array<{
  id: string;
  path: string;
  name: string;
  messageCount: number;
  lastModified: string;
}>> {
  try {
    // 使用 getLocalSessionsDir 获取编码后的目录路径
    const localSessionsDir = getLocalSessionsDir(workingDir);
    const sessions = await SessionManager.list(workingDir, localSessionsDir);
    
    logger.info(`[Init] Found ${sessions.length} sessions for ${workingDir} in ${localSessionsDir}`);
    
    return sessions.map(s => ({
      id: s.path,
      path: s.path,
      name: s.firstMessage?.slice(0, 35) || s.path?.split("/").pop() || "Untitled",
      messageCount: s.messageCount || 0,
      lastModified: s.modified.toISOString(),
    }));
  } catch (e) {
    logger.error(`[Init] Failed to list sessions: ${e}`);
    return [];
  }
}

/**
 * 获取模型列表
 */
async function getAllModels(): Promise<Array<{
  id: string;
  name: string;
  provider?: string;
  maxTokens?: number;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
}>> {
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
    logger.error(`[Init] Failed to load models: ${e}`);
    return [];
  }
}

/**
 * 读取 session 文件内容（JSONL）
 */
async function getSessionMessages(sessionFile: string): Promise<any[]> {
  try {
    if (!existsSync(sessionFile)) {
      return [];
    }
    const content = await readFile(sessionFile, "utf-8");
    const lines = content.split("\n").filter(line => line.trim());
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    logger.error(`[Init] Failed to read session file: ${e}`);
    return [];
  }
}

/**
 * Handle init message
 */
export async function handleInit(
  ctx: WSContext,
  payload: {
    workingDir?: string;
  }
): Promise<void> {
  const { workingDir: clientWorkingDir } = payload;

  logger.info(`[WebSocket] Received init message: clientWorkingDir=${clientWorkingDir || "not provided"}`);

  try {
    // 1. 确定要使用的工作目录
    let workingDir: string = clientWorkingDir || process.cwd();
    
    // 如果客户端没有提供，使用服务器当前工作目录
    if (!clientWorkingDir) {
      logger.info(`[WebSocket] No workingDir provided, using default: ${workingDir}`);
    }

    // 检查路径是否存在
    if (!existsSync(workingDir)) {
      logger.error(`[WebSocket] Path does not exist: ${workingDir}`);
      ctx.ws.send(
        JSON.stringify({
          type: "error",
          error: `Path does not exist: ${workingDir}`,
        })
      );
      return;
    }

    // 2. 获取或创建 session
    // serverSessionManager 会自动处理：
    // - 如果已有相同 workingDir 的 session → 复用
    // - 如果没有 → 创建新的
    // - 后来的客户端会踢掉之前的
    const session = await serverSessionManager.getOrCreateSession(
      workingDir,
      ctx.ws
    );

    // Update context
    ctx.session = session;

    // 检查 session 是否有效
    if (!session.session) {
      throw new Error("Failed to create or get session");
    }

    // 3. 收集所有需要返回的数据
    const targetDir = workingDir as string;
    let sessionFile = session.session.sessionFile as string;
    let sessionId = session.session.sessionId as string;
    let sessionMessages = await getSessionMessages(sessionFile);
    
    // 如果当前 session 没有消息，尝试加载最近的有消息的 session
    if (sessionMessages.length === 0) {
      logger.info(`[Init] Current session has no messages, trying to find recent session with messages`);
      const allSessionsList = await getAllSessions(targetDir);
      // 按最后修改时间排序，找最近的有消息的 session
      for (const s of allSessionsList.sort((a, b) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      )) {
        const msgs = await getSessionMessages(s.path);
        if (msgs.length > 0) {
          logger.info(`[Init] Found session with messages: ${s.path} (${msgs.length} messages)`);
          sessionFile = s.path;
          sessionId = s.path.split('/').pop()?.replace('.jsonl', '').split('_').pop() || sessionId;
          sessionMessages = msgs;
          break;
        }
      }
    }
    
    const [
      allSessions,
      allModels,
    ] = await Promise.all([
      getAllSessions(targetDir),
      getAllModels(),
    ]);

    // 4. 构建响应
    const response = {
      type: "initialized",
      pid: process.pid,
      workingDir,
      currentSession: {
        sessionId: sessionId,
        sessionFile: sessionFile,
        messages: sessionMessages,
      },
      allSessions,
      currentModel: session.session!.model?.id || null,
      allModels,
      thinkingLevel: session.session!.thinkingLevel,
    };

    ctx.ws.send(JSON.stringify(response));

    logger.info(`[WebSocket] init successful: pid=${process.pid}, sessionId=${session.session!.sessionId}, sessions=${allSessions.length}, models=${allModels.length}`);
  } catch (error) {
    logger.error("[WebSocket] init error:", {}, error instanceof Error ? error : undefined);
    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to initialize session",
      })
    );
  }
}
