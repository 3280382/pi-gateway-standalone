/**
 * Session Message Processor
 *
 * Pre-processes session entries on the server side to merge tool results
 * with their parent assistant messages. This avoids expensive tree traversal
 * on the client side for large sessions.
 */

import type { ContentPart, Message } from "../../../shared/types/chat.types";

interface SessionEntry {
  type: string;
  id?: string;
  parentId?: string;
  timestamp?: string;
  message?: {
    role: string;
    content: any;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Detect message kind based on content for historical messages
 */
function detectMessageKind(message: any): string | undefined {
  if (!message || message.kind) return message?.kind;

  // Only process system messages
  if (message.role !== "system") return undefined;

  const text =
    message.content
      ?.filter((c: any) => c.type === "text")
      ?.map((c: any) => c.text || "")
      ?.join(" ") || "";

  // Check for special system message types
  if (text.includes("🗜️ Compacting") || text.includes("上下文压缩")) return "compaction";
  if (text.includes("🔄 Retrying") && text.includes("Auto-retrying")) return "auto_retry";
  if (text.includes("🔄 Retrying")) return "retry";
  if (text.includes("模型已切换为") || text.includes("Model switched")) return "model_change";
  if (text.includes("Thinking level") || text.includes("Thinking level已设置"))
    return "thinking_level_change";
  if (text.includes("📊") || text.includes("tokens") || text.includes("Usage:")) return "usage";

  return undefined;
}

/**
 * Process session entries on the server side
 * Merges toolResults into their parent assistant messages
 */
export function processSessionEntries(entries: SessionEntry[]): {
  entries: SessionEntry[];
  messages: Message[];
} {
  // Build ID lookup map
  const entryById = new Map<string, SessionEntry>();
  entries.forEach((entry) => {
    if (entry.id) {
      entryById.set(entry.id, entry);
    }
  });

  // Build parent -> children map for toolResults
  const toolResultsByParentId = new Map<string, SessionEntry[]>();
  entries.forEach((entry) => {
    if (
      entry.type === "message" &&
      entry.message?.role === "toolResult" &&
      entry.parentId
    ) {
      if (!toolResultsByParentId.has(entry.parentId)) {
        toolResultsByParentId.set(entry.parentId, []);
      }
      toolResultsByParentId.get(entry.parentId)!.push(entry);
    }
  });

  // Iterative collection of all tool results for a message (handles chain structure)
  function collectAllToolResults(messageId: string): SessionEntry[] {
    const results: SessionEntry[] = [];
    const queue: string[] = [messageId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const children = toolResultsByParentId.get(currentId) || [];
      for (const child of children) {
        results.push(child);
        if (child.id) {
          queue.push(child.id);
        }
      }
    }

    return results;
  }

  // Process entries into messages
  const messages: Message[] = [];

  for (const entry of entries) {
    // Handle special entry types
    if (entry.type !== "message") {
      const specialMessage = convertSpecialEntryToMessage(entry);
      if (specialMessage) {
        messages.push(specialMessage);
      }
      continue;
    }

    const msg = entry.message;
    if (!msg) continue;

    // Skip toolResults - they're merged into parent assistant messages
    if (msg.role === "toolResult") {
      continue;
    }

    // Normalize content
    const contentArray = normalizeContent(msg.content);

    // Collect all tool results for this message (including chained ones)
    const toolResults = entry.id ? collectAllToolResults(entry.id) : [];

    // Build tool result lookup by toolCallId
    const toolResultByToolCallId = new Map<string, SessionEntry>();
    toolResults.forEach((toolResult) => {
      const toolCallId = toolResult.message?.toolCallId;
      if (toolCallId) {
        toolResultByToolCallId.set(toolCallId, toolResult);
      }
    });

    // Merge tool results into content
    const normalizedContent: ContentPart[] = [];
    const processedToolCallIds = new Set<string>();

    for (const item of contentArray) {
      if (item.type === "toolCall" || item.type === "tool_use") {
        const toolCallId = item.id || item.toolCallId;
        const toolResult = toolResultByToolCallId.get(toolCallId);

        if (toolResult) {
          // Merge with tool result
          const resultMsg = toolResult.message;
          let contentText = "";
          if (Array.isArray(resultMsg?.content)) {
            contentText = resultMsg.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("");
          } else if (typeof resultMsg?.content === "string") {
            contentText = resultMsg.content;
          }

          normalizedContent.push({
            type: "tool" as const,
            toolCallId: toolCallId,
            toolName:
              item.name ||
              item.toolName ||
              resultMsg?.toolName ||
              "unknown",
            args: item.arguments || item.input || {},
            output: resultMsg?.isError ? undefined : contentText,
            error: resultMsg?.isError ? contentText : undefined,
            status: resultMsg?.isError ? "error" : "success",
          });
          processedToolCallIds.add(toolCallId);
        } else {
          // No result yet, show as pending
          normalizedContent.push({
            type: "tool_use" as const,
            toolCallId: toolCallId || `tool-${Date.now()}`,
            toolName: item.name || item.toolName || "unknown",
            partialArgs: item.arguments
              ? JSON.stringify(item.arguments, null, 2)
              : undefined,
            args: item.arguments || item.input,
            status: "pending",
          });
        }
      } else {
        normalizedContent.push(normalizeContentItem(item));
      }
    }

    // Add unmatched tool results (edge case)
    for (const toolResult of toolResults) {
      const resultMsg = toolResult.message;
      const toolCallId = resultMsg?.toolCallId;

      if (toolCallId && !processedToolCallIds.has(toolCallId)) {
        let contentText = "";
        if (Array.isArray(resultMsg?.content)) {
          contentText = resultMsg.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("");
        } else if (typeof resultMsg?.content === "string") {
          contentText = resultMsg.content;
        }

        normalizedContent.push({
          type: "tool" as const,
          toolCallId: toolCallId,
          toolName: resultMsg?.toolName || "unknown",
          args: {},
          output: resultMsg?.isError ? undefined : contentText,
          error: resultMsg?.isError ? contentText : undefined,
          status: resultMsg?.isError ? "error" : "success",
        });
      }
    }

    // Detect message kind for system messages (compaction, retry, etc.)
    const kind = msg.role === "system" ? detectMessageKind(msg) : undefined;

    const message: Message = {
      id: entry.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: msg.role as "user" | "assistant" | "system",
      content: normalizedContent,
      timestamp: new Date(entry.timestamp || Date.now()),
      usage: msg.usage,
      model: msg.model,
      provider: msg.provider,
      stopReason: msg.stopReason,
      isStreaming: false,
      isThinkingCollapsed: true,
      isToolsCollapsed: true,
      isMessageCollapsed: false,
      kind,
    };

    messages.push(message);
  }

  return { entries, messages };
}

function normalizeContent(rawContent: any): any[] {
  if (!rawContent) return [];
  if (Array.isArray(rawContent)) return rawContent;
  if (typeof rawContent === "string") {
    return [{ type: "text", text: rawContent }];
  }
  return [rawContent];
}

function normalizeContentItem(item: any): ContentPart {
  if (typeof item === "string") {
    return { type: "text", text: item };
  }
  if (item?.type === "text") {
    return { type: "text", text: item.text || "" };
  }
  if (item?.type === "thinking") {
    return {
      type: "thinking",
      thinking: item.thinking || "",
      thinkingSignature: item.thinkingSignature,
    };
  }
  if (item?.type === "toolCall" || item?.type === "tool_use") {
    return {
      type: "tool_use",
      toolCallId: item.id || item.toolCallId || `tool-${Date.now()}`,
      toolName: item.name || item.toolName || "unknown",
      args: item.arguments || item.input || {},
      partialArgs: item.partialArgs,
      status: item.status || "pending",
    };
  }
  return { type: "text", text: String(item) };
}

function convertSpecialEntryToMessage(entry: SessionEntry): Message | null {
  const baseMessage = {
    id: entry.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: "system" as const,
    timestamp: new Date(entry.timestamp || Date.now()),
    isStreaming: false,
    isThinkingCollapsed: true,
    isToolsCollapsed: true,
    isMessageCollapsed: false,
  };

  switch (entry.type) {
    case "model_change":
      return {
        ...baseMessage,
        id: entry.id || `model-${Date.now()}`,
        content: [
          {
            type: "text" as const,
            text: `🤖 Model switched to: ${entry.provider}/${entry.modelId}`,
          },
        ],
        kind: "model_change",
      };
    case "thinking_level_change":
      return {
        ...baseMessage,
        id: entry.id || `thinking-${Date.now()}`,
        content: [
          {
            type: "text" as const,
            text: `🧠 Thinking level set to: ${entry.thinkingLevel}`,
          },
        ],
        kind: "thinking_level_change",
      };
    case "compaction":
      return {
        ...baseMessage,
        id: entry.id || `compact-${Date.now()}`,
        content: [
          {
            type: "text" as const,
            text: `🗜️ Context compaction: ${entry.summary || "Context compressed"}${entry.tokensBefore > 0 ? ` (freed ~${entry.tokensBefore} tokens)` : ""}`,
          },
        ],
        kind: "compaction",
      };
    case "usage": {
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

        return {
          ...baseMessage,
          id: entry.id || `usage-${Date.now()}`,
          content: [{ type: "text" as const, text: message }],
          kind: "usage",
        };
      }
      return null;
    }
    default:
      return null;
  }
}
