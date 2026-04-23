/**
 * Chat WebSocket Service - Chat 特定的 WebSocket 方法
 *
 * Responsibilities:
 * - 封装 chat feature 特定的 WebSocket 调用
 * - 委托通用连接操作给 websocketService
 */

import { websocketService } from "@/services/websocket.service";

/**
 * 发送聊天消息（对应后端的 prompt 类型）
 */
export function sendChatMessage(
  text: string,
  sessionId?: string,
  model?: string,
  images?: Array<{
    type: "image";
    source: { type: "base64"; mediaType: string; data: string };
  }>
): boolean {
  return websocketService.send("prompt", {
    text,
    sessionId,
    model,
    images,
  });
}

/**
 * 中止生成（对应后端的 abort 类型）
 */
export function abortChatGeneration(): boolean {
  return websocketService.send("abort");
}

/**
 * 初始化工作directories（对应后端的 init 类型）
 * 返回 Promise 等待 initialized 响应
 *
 * @param path 工作directories路径
 * @param sessionFile Session files路径（可选，用于Exact match session）
 * @param timeoutMs 超时时间
 */
export function initChatWorkingDirectory(
  path?: string,
  sessionFile?: string,
  timeoutMs = 10000, // 增加到 10 秒，因为初始化可能需要加载模型和files系统
  messageLimit?: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    // 设置一次性监听器等待 initialized 响应
    const unsubscribeInitialized = websocketService.on("initialized", (data: unknown) => {
      unsubscribeInitialized();
      unsubscribeError();
      resolve(data);
    });

    // 也监听 error 事件
    const unsubscribeError = websocketService.on("error", (data: unknown) => {
      unsubscribeInitialized();
      unsubscribeError();
      reject(new Error(`Server error: ${JSON.stringify(data)}`));
    });

    // 超时
    setTimeout(() => {
      unsubscribeInitialized();
      unsubscribeError();
      reject(new Error(`Timeout waiting for initialization (${timeoutMs}ms)`));
    }, timeoutMs);

    // Send init message
    const payload: { workingDir?: string; sessionFile?: string; messageLimit?: number } = {};
    if (path) payload.workingDir = path;
    if (sessionFile) payload.sessionFile = sessionFile;
    if (messageLimit !== undefined) payload.messageLimit = messageLimit;

    const sent = websocketService.send("init", payload);

    if (!sent) {
      unsubscribeInitialized();
      unsubscribeError();
      reject(new Error("Failed to send init message"));
    }
  });
}

/**
 * 流式传输时引导（对应后端的 steer 类型）
 */
export function steerChat(text: string): boolean {
  return websocketService.send("steer", { text });
}

/**
 * 执RowsCommand（对应后端的 command 类型）
 */
export function executeChatCommand(command: string): boolean {
  return websocketService.send("command", { text: command });
}

/**
 * Compact session（对应后端的 compact_session 类型）
 */
export function compactSession(customInstructions?: string): boolean {
  return websocketService.send("compact_session", { customInstructions });
}

/**
 * Export session（对应后端的 export_session 类型）
 */
export function exportSession(outputPath?: string): boolean {
  return websocketService.send("export_session", { outputPath });
}

/**
 * Cols出会话（对应后端的 list_sessions 类型）
 */
export function listChatSessions(cwd: string): boolean {
  return websocketService.send("list_sessions", { cwd });
}

/**
 * Load more历史消息（对应后端的 load_more_messages 类型）
 * 当用户滚动到消息顶部时调用
 */
export function loadMoreMessages(sessionFile: string, offset: number, limit: number = 50): boolean {
  return websocketService.send("load_more_messages", { sessionFile, offset, limit });
}

/**
 * Set model（对应后端的 set_model 类型）
 */
export function setChatModel(provider: string, modelId: string, thinkingLevel?: string): boolean {
  console.log("[ChatWebSocket] setModel called:", {
    provider,
    modelId,
    thinkingLevel,
  });
  return websocketService.send("set_model", {
    provider,
    modelId,
    thinkingLevel,
  });
}

/**
 * 发送Thinking level变更
 */
export function setChatThinkingLevel(level: string): boolean {
  return websocketService.send("thinking_level_change", { thinkingLevel: level });
}

/**
 * 创建新 session
 */
export function createNewChatSession(workingDir?: string): boolean {
  return websocketService.send("new_session", { workingDir });
}
