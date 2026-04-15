/**
 * Message Utilities - 统一的 Session 消息转换
 *
 * 这个文件包含统一的消息转换逻辑，用于：
 * - 页面刷新时的 init 响应处理
 * - 左侧面板选择 session 时的加载
 * - HTTP loadSession 响应处理
 *
 * 关键特性：
 * - 正确处理 toolCall 和 toolResult 的关系
 * - 统一的消息格式转换
 */

import type { Message } from "@/features/chat/types/chat";

/**
 * 将 content 归一化为数组格式
 */
export function normalizeContent(rawContent: any): any[] {
  if (!rawContent) return [];
  if (Array.isArray(rawContent)) return rawContent;
  if (typeof rawContent === "string") return [{ type: "text", text: rawContent }];
  if (typeof rawContent === "object") return [rawContent];
  return [{ type: "text", text: String(rawContent) }];
}

/**
 * 归一化单个 content item
 */
export function normalizeContentItem(item: any): any {
  if (!item || typeof item !== "object") {
    return { type: "text", text: String(item || "") };
  }

  const type = item.type || "text";
  switch (type) {
    case "thinking":
      return {
        type: "thinking" as const,
        thinking: item.thinking || item.text || "",
        signature: item.thinkingSignature || item.signature,
      };
    case "text":
      return { type: "text" as const, text: item.text || "" };
    case "toolCall":
    case "tool_use":
      return {
        type: "tool_use" as const,
        toolCallId: item.id || item.toolCallId || `tool-${Date.now()}`,
        toolName: item.name || item.toolName || "unknown",
        args: item.arguments || item.args || {},
        partialArgs: item.partialArgs,
      };
    case "toolResult":
    case "tool_result":
    case "tool": {
      let contentText = "";
      if (Array.isArray(item.content)) {
        contentText = item.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("");
      } else if (typeof item.content === "string") {
        contentText = item.content;
      }

      return {
        type: "tool" as const,
        toolCallId: item.toolCallId || item.id,
        toolName: item.toolName || item.name || "unknown",
        output: item.isError ? undefined : contentText || item.output,
        error: item.isError ? contentText || item.error : undefined,
        args: item.args || {},
      };
    }
    case "image":
      return {
        type: "image" as const,
        imageUrl: item.imageUrl || item.url || item.source?.data,
      };
    default:
      return {
        type: "text" as const,
        text: item.text || String(item),
      };
  }
}

/**
 * 统一的 Session 消息转换函数
 *
 * 处理流程：
 * 1. 第一遍遍历：收集所有 toolCall 的参数
 * 2. 第二遍遍历：转换消息，处理 toolResult
 *
 * @param entries Session 文件中的 entries 数组（JSONL 解析后的）
 * @returns 转换后的 Message 数组
 */
export function normalizeSessionMessages(entries: any[]): Message[] {
  // 第一遍：收集所有 toolCall 的参数
  const toolCallArgsMap = new Map<string, any>();
  entries.forEach((entry: any) => {
    if (
      entry.type === "message" &&
      entry.message?.role === "assistant" &&
      Array.isArray(entry.message.content)
    ) {
      entry.message.content.forEach((item: any) => {
        if (item.type === "toolCall" && item.id) {
          toolCallArgsMap.set(item.id, item.arguments || {});
        }
      });
    }
  });

  return entries
    .filter((entry: any) => entry.type === "message" && entry.message)
    .map((entry: any) => {
      const msg = entry.message;

      // 特殊处理 toolResult 消息
      if (msg.role === "toolResult") {
        let contentText = "";
        if (Array.isArray(msg.content)) {
          contentText = msg.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("");
        } else if (typeof msg.content === "string") {
          contentText = msg.content;
        }

        const args = toolCallArgsMap.get(msg.toolCallId) || {};

        return {
          id: entry.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: "assistant" as const,
          content: [
            {
              type: "tool" as const,
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              output: msg.isError ? undefined : contentText,
              error: msg.isError ? contentText : undefined,
              args: args,
            },
          ],
          timestamp: new Date(msg.timestamp || entry.timestamp || Date.now()),
          isStreaming: false,
          isThinkingCollapsed: true,
          isToolsCollapsed: true,
          isMessageCollapsed: false,
        };
      }

      // 普通消息处理
      const rawContent = msg.content;
      const contentArray = normalizeContent(rawContent);

      // 过滤掉 toolCall，避免重复显示（toolResult 已经单独处理了）
      const filteredContent = contentArray.filter((item: any) => {
        if (item.type === "toolCall") {
          return false;
        }
        return true;
      });

      // 转换 content items
      const normalizedContent = filteredContent.map(normalizeContentItem);

      return {
        id: entry.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: msg.role || "user",
        content: normalizedContent,
        timestamp: new Date(msg.timestamp || entry.timestamp || Date.now()),
        isStreaming: false,
        isThinkingCollapsed: true,
        isToolsCollapsed: true,
        isMessageCollapsed: false,
      };
    });
}
