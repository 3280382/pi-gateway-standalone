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
 * 生成系统消息
 */
function createSystemMessage(text: string, id?: string, kind?: Message["kind"]): Message {
  return {
    id: id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: "system",
    content: [{ type: "text", text }],
    timestamp: new Date(),
    isStreaming: false,
    isThinkingCollapsed: true,
    isToolsCollapsed: true,
    kind,
    isMessageCollapsed: false,
  };
}

/**
 * 将特殊 entry 类型转换为系统消息文本
 */
function convertSpecialEntryToMessage(entry: any): Message | null {
  switch (entry.type) {
    case "model_change": {
      const provider = entry.provider || "unknown";
      const modelId = entry.modelId || "unknown";
      return createSystemMessage(`🤖 模型已切换为: ${provider}/${modelId}`, entry.id);
    }
    case "compaction": {
      const summary = entry.summary || "上下文已压缩";
      const tokensBefore = entry.tokensBefore || 0;
      return createSystemMessage(
        `🗜️ 上下文压缩: ${summary}${tokensBefore > 0 ? ` (释放约 ${tokensBefore} tokens)` : ""}`,
        entry.id,
        "compaction"
      );
    }
    case "thinking_level_change": {
      const level = entry.thinkingLevel || "unknown";
      return createSystemMessage(`🧠 思考级别已设置为: ${level}`, entry.id);
    }
    case "usage": {
      // Handle usage/cost information
      const usage = entry.usage;
      if (usage) {
        const inputTokens = usage.inputTokens || usage.input_tokens || 0;
        const outputTokens = usage.outputTokens || usage.output_tokens || 0;
        const totalTokens = usage.totalTokens || usage.total_tokens || (inputTokens + outputTokens);
        const cost = usage.cost || usage.estimatedCost || 0;
        
        let message = `📊 Usage: ${totalTokens.toLocaleString()} tokens`;
        if (inputTokens || outputTokens) {
          message += ` (input: ${inputTokens.toLocaleString()}, output: ${outputTokens.toLocaleString()})`;
        }
        if (cost) {
          message += ` · $${cost.toFixed(4)}`;
        }
        if (usage.model) {
          message += ` · ${usage.model}`;
        }
        return createSystemMessage(message, entry.id);
      }
      return null;
    }
    case "cost": {
      // Handle cost-only entries
      const cost = entry.cost || entry.estimatedCost || 0;
      const currency = entry.currency || "$";
      return createSystemMessage(`💰 Cost: ${currency}${cost.toFixed(4)}`, entry.id);
    }
    case "custom": {
      const customType = entry.customType || "custom";
      const data = entry.data ? JSON.stringify(entry.data).slice(0, 100) : "";
      return createSystemMessage(`📌 ${customType}${data ? `: ${data}` : ""}`, entry.id);
    }
    default:
      return null;
  }
}

/**
 * 统一的 Session 消息转换函数
 *
 * 处理流程：
 * 1. 第一遍遍历：收集所有 toolCall 的参数
 * 2. 第二遍遍历：转换消息，处理 toolResult 和特殊 entry 类型
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

  const messages: Message[] = [];

  entries.forEach((entry: any) => {
    // 处理特殊 entry 类型（model_change, compaction 等）
    if (entry.type !== "message") {
      const specialMessage = convertSpecialEntryToMessage(entry);
      if (specialMessage) {
        messages.push(specialMessage);
      }
      return;
    }

    const msg = entry.message;
    if (!msg) return;

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

      messages.push({
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
      });
      return;
    }

    // 普通消息处理
    const rawContent = msg.content;
    const contentArray = normalizeContent(rawContent);

    // 转换 content items，保留 toolCall 并标记状态
    const normalizedContent = contentArray.map((item: any) => {
      if (item.type === "toolCall" || item.type === "tool_use") {
        const toolCallId = item.id || item.toolCallId;
        // 检查是否有对应的 toolResult
        const hasResult = entries.some((e: any) => 
          e.type === "message" && 
          e.message?.role === "toolResult" && 
          e.message?.toolCallId === toolCallId
        );
      
        return {
          type: "tool_use" as const,
          toolCallId: toolCallId || `tool-${Date.now()}`,
          toolName: item.name || item.toolName || "unknown",
          partialArgs: item.arguments ? JSON.stringify(item.arguments, null, 2) : undefined,
          args: item.arguments,
          status: hasResult ? "executing" : "pending",
        };
      }
      return normalizeContentItem(item);
    });

    messages.push({
      id: entry.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: msg.role || "user",
      content: normalizedContent,
      timestamp: new Date(msg.timestamp || entry.timestamp || Date.now()),
      isStreaming: false,
      isThinkingCollapsed: true,
      isToolsCollapsed: true,
      isMessageCollapsed: false,
    });

    // 如果是 assistant 消息且有 usage 信息，添加 usage 消息
    if (msg.role === "assistant" && msg.usage) {
      const usage = msg.usage;
      const inputTokens = usage.input || usage.inputTokens || 0;
      const outputTokens = usage.output || usage.outputTokens || 0;
      const totalTokens = usage.totalTokens || (inputTokens + outputTokens);
      const cost = usage.cost?.total ?? (typeof usage.cost === 'number' ? usage.cost : 0);

      let usageMessage = `📊 Usage: ${totalTokens.toLocaleString()} tokens`;
      if (inputTokens || outputTokens) {
        usageMessage += ` (input: ${inputTokens.toLocaleString()}, output: ${outputTokens.toLocaleString()})`;
      }
      if (cost && cost > 0) {
        usageMessage += ` · $${Number(cost).toFixed(4)}`;
      }
      if (msg.model) {
        usageMessage += ` · ${msg.model}`;
      }

      messages.push({
        id: `usage-${entry.id || Date.now()}`,
        role: "system",
        content: [{ type: "text", text: usageMessage }],
        timestamp: new Date(msg.timestamp || entry.timestamp || Date.now()),
        isStreaming: false,
        isThinkingCollapsed: true,
        isToolsCollapsed: true,
        isMessageCollapsed: false,
      });
    }
  });

  return messages;
}
