/**
 * Change Directory Message Handler
 * Handles requests to switch working directory using server-level session management
 * 
 * Architecture:
 * - When switching directory, end the old session and create new one with new workingDir
 * - ServerSessionManager handles the session lifecycle
 * - Returns complete data same as init (pid, workingDir, currentSession, allSessions, currentModel, allModels, thinkingLevel, messages)
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
    
    logger.info(`[ChangeDir] Found ${sessions.length} sessions for ${workingDir} in ${localSessionsDir}`);
    
    return sessions.map(s => ({
      id: s.path,
      path: s.path,
      name: s.firstMessage?.slice(0, 35) || s.path?.split("/").pop() || "Untitled",
      messageCount: s.messageCount || 0,
      lastModified: s.modified.toISOString(),
    }));
  } catch (e) {
    logger.error(`[ChangeDir] Failed to list sessions: ${e}`);
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
    logger.error(`[ChangeDir] Failed to load models: ${e}`);
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
    logger.error(`[ChangeDir] Failed to read session file: ${e}`);
    return [];
  }
}

/**
 * Handle change_dir message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleChangeDir(ctx: WSContext, payload: { path: string; currentPath?: string }): Promise<void> {
  const { path: newPath, currentPath } = payload;

  logger.info(`[change_dir] ========== START ==========`);
  logger.info(`[change_dir] 1. Received from client: newPath="${newPath}"`);

  try {
    // 检查路径是否存在
    if (!existsSync(newPath)) {
      logger.error(`[change_dir] ERROR: Path does not exist: "${newPath}"`);
      ctx.ws.send(
        JSON.stringify({
          type: "error",
          error: `Path does not exist: ${newPath}`,
        })
      );
      return;
    }

    // Determine current working directory
    const oldWorkingDir = currentPath || ctx.session?.workingDir || null;
    logger.info(`[change_dir] 2. Old working directory: "${oldWorkingDir}"`);

    // Use server session manager to switch session
    logger.info(`[change_dir] 3. Calling serverSessionManager.switchSession...`);
    
    const session = await serverSessionManager.switchSession(
      oldWorkingDir || newPath,
      newPath,
      ctx.ws
    );

    // Update context with new session
    ctx.session = session;

    if (!session.session) {
      throw new Error("Failed to create or get session");
    }

    logger.info(`[change_dir] 4. Session switched: sessionId="${session.session.sessionId}"`);

    // 收集所有需要返回的数据（和 init 一样）
    const targetDir = newPath as string;
    const sessionFile = session.session.sessionFile as string;
    
    const [
      allSessions,
      allModels,
      sessionMessages,
    ] = await Promise.all([
      getAllSessions(targetDir),
      getAllModels(),
      getSessionMessages(sessionFile),
    ]);

    // 构建完整响应（和 init 一样的格式）
    const response = {
      type: "dir_changed",
      pid: process.pid,
      workingDir: newPath,
      currentSession: {
        sessionId: session.session.sessionId,
        sessionFile: session.session.sessionFile,
        messages: sessionMessages,
      },
      allSessions,
      currentModel: session.session.model?.id || null,
      allModels,
      thinkingLevel: session.session.thinkingLevel,
    };

    logger.info(`[change_dir] 5. Sending complete response: sessions=${allSessions.length}, models=${allModels.length}, messages=${sessionMessages.length}`);

    ctx.ws.send(JSON.stringify(response));

    logger.info(`[change_dir] ========== END (success) ==========`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[change_dir] ERROR: ${errorMessage}`);

    ctx.ws.send(
      JSON.stringify({
        type: "error",
        error: errorMessage,
      })
    );
  }
}
