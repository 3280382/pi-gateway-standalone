/**
 * Message Utilities - Unified Session message transformation
 *
 * These contain unified message conversion logic, used for:
 * - init response processing when page refreshes
 * - Loading when selecting sessions from left panel
 * - HTTP loadSession response processing
 *
 * Key features:
 * - Correctly handle toolCall and toolResult relationships using parentId
 * - Unified message format conversion
 * - Tree structure awareness (id/parentId relationships)
 */

import type { Message } from "@/features/chat/types/chat";

/**
 * Helper to handle server-preprocessed messages
 * Server always returns preprocessed messages, use them directly
 */
export function handleServerMessages(serverMessages: any[]): Message[] {
  if (!serverMessages?.length) return [];
  // Server always returns preprocessed messages
  return serverMessages as Message[];
}

/**
 * Normalize content to array format
 */
export function normalizeContent(rawContent: any): any[] {
  if (!rawContent) return [];
  if (Array.isArray(rawContent)) return rawContent;
  if (typeof rawContent === "string") return [{ type: "text", text: rawContent }];
  if (typeof rawContent === "object") return [rawContent];
  return [{ type: "text", text: String(rawContent) }];
}

/**
 * Normalize single content item
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
 * Create system message
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
 * Convert special entry types to system message text
 */
function convertSpecialEntryToMessage(entry: any): Message | null {
  switch (entry.type) {
    case "model_change": {
      const provider = entry.provider || "unknown";
      const modelId = entry.modelId || "unknown";
      return createSystemMessage(`🤖 Model switched to: ${provider}/${modelId}`, entry.id);
    }
    case "compaction": {
      const summary = entry.summary || "Context compressed";
      const tokensBefore = entry.tokensBefore || 0;
      return createSystemMessage(
        `🗜️ Context compaction: ${summary}${tokensBefore > 0 ? ` (freed ~${tokensBefore} tokens)` : ""}`,
        entry.id,
        "compaction"
      );
    }
    case "thinking_level_change": {
      const level = entry.thinkingLevel || "unknown";
      return createSystemMessage(`🧠 Thinking level set to: ${level}`, entry.id);
    }
    case "usage": {
      // Handle usage/cost information
      const usage = entry.usage;
      if (usage) {
        const inputTokens = usage.inputTokens || usage.input_tokens || 0;
        const outputTokens = usage.outputTokens || usage.output_tokens || 0;
        const totalTokens = usage.totalTokens || usage.total_tokens || inputTokens + outputTokens;
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
 * Unified Session message conversion function
 *
 * Uses parentId tree structure to properly associate tool results with their calls.
 * Single-pass processing with lookup maps for O(n) complexity.
 *
 * @param entries Session file entries array (JSONL parsed)
 * @returns Converted Message array
 */
export function normalizeSessionMessages(entries: any[]): Message[] {
  // Build id -> entry map for O(1) lookup
  const entryById = new Map<string, any>();
  entries.forEach((entry: any) => {
    if (entry.id) {
      entryById.set(entry.id, entry);
    }
  });

  // Build parentId -> children[] map
  const childrenByParentId = new Map<string, any[]>();
  entries.forEach((entry: any) => {
    if (entry.parentId) {
      if (!childrenByParentId.has(entry.parentId)) {
        childrenByParentId.set(entry.parentId, []);
      }
      childrenByParentId.get(entry.parentId)?.push(entry);
    }
  });

  // Collect toolResults by their parent assistant message id
  // parentId of toolResult points to the assistant message that made the tool call
  // OR points to another toolResult (forming a chain)
  const toolResultsByParentId = new Map<string, any[]>();
  entries.forEach((entry: any) => {
    if (entry.type === "message" && entry.message?.role === "toolResult") {
      const parentId = entry.parentId;
      if (parentId) {
        if (!toolResultsByParentId.has(parentId)) {
          toolResultsByParentId.set(parentId, []);
        }
        toolResultsByParentId.get(parentId)?.push(entry);
      }
    }
  });

  // Helper function to recursively collect all toolResults that belong to a message
  // This handles the chain structure where toolResults form a linked list via parentId
  function collectAllToolResults(messageId: string, visited = new Set<string>()): any[] {
    if (visited.has(messageId)) return []; // Prevent infinite loops
    visited.add(messageId);

    const directChildren = toolResultsByParentId.get(messageId) || [];
    const allResults: any[] = [...directChildren];

    // Recursively collect from each child (toolResults can have their own children)
    for (const child of directChildren) {
      if (child.id) {
        const grandChildren = collectAllToolResults(child.id, visited);
        allResults.push(...grandChildren);
      }
    }

    return allResults;
  }

  const messages: Message[] = [];

  entries.forEach((entry: any) => {
    // Handle special entry types (model_change, compaction, etc.)
    if (entry.type !== "message") {
      const specialMessage = convertSpecialEntryToMessage(entry);
      if (specialMessage) {
        messages.push(specialMessage);
      }
      return;
    }

    const msg = entry.message;
    if (!msg) return;

    // Skip toolResult entries - they're merged into their parent assistant message
    if (msg.role === "toolResult") {
      return;
    }

    // Skip messages that are tool results (parent is an assistant message with matching toolCall)
    // This handles the case where toolResult appears before its parent in the list
    if (msg.role === "toolResult") {
      return;
    }

    // Normal message processing
    const rawContent = msg.content;
    const contentArray = normalizeContent(rawContent);

    // Build normalized content, merging tool results using parentId relationship
    const normalizedContent: any[] = [];
    const processedToolCallIds = new Set<string>();

    // First: collect all toolCallIds from this message's content
    const toolCallIdsInMessage = new Set<string>();
    contentArray.forEach((item: any) => {
      if (item.type === "toolCall" || item.type === "tool_use") {
        const toolCallId = item.id || item.toolCallId;
        if (toolCallId) {
          toolCallIdsInMessage.add(toolCallId);
        }
      }
    });

    // Find toolResults that belong to this message (including chained toolResults)
    // Use recursive collection to handle the chain structure
    const toolResults = entry.id ? collectAllToolResults(entry.id) : [];
    const toolResultByToolCallId = new Map<string, any>();
    toolResults.forEach((toolResultEntry: any) => {
      const toolCallId = toolResultEntry.message?.toolCallId;
      if (toolCallId) {
        toolResultByToolCallId.set(toolCallId, toolResultEntry);
      }
    });

    // Convert content items
    contentArray.forEach((item: any) => {
      if (item.type === "toolCall" || item.type === "tool_use") {
        const toolCallId = item.id || item.toolCallId;
        const toolResult = toolResultByToolCallId.get(toolCallId);

        if (toolResult) {
          // Merge with toolResult
          const resultMsg = toolResult.message;
          let contentText = "";
          if (Array.isArray(resultMsg.content)) {
            contentText = resultMsg.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("");
          } else if (typeof resultMsg.content === "string") {
            contentText = resultMsg.content;
          }

          normalizedContent.push({
            type: "tool" as const,
            toolCallId: toolCallId,
            toolName: item.name || item.toolName || resultMsg.toolName || "unknown",
            args: item.arguments || {},
            output: resultMsg.isError ? undefined : contentText,
            error: resultMsg.isError ? contentText : undefined,
            status: resultMsg.isError ? "error" : "success",
          });
          processedToolCallIds.add(toolCallId);
        } else {
          // No result yet, show as pending tool_use
          normalizedContent.push({
            type: "tool_use" as const,
            toolCallId: toolCallId || `tool-${Date.now()}`,
            toolName: item.name || item.toolName || "unknown",
            partialArgs: item.arguments ? JSON.stringify(item.arguments, null, 2) : undefined,
            args: item.arguments,
            status: "pending",
          });
        }
      } else {
        // Non-tool content
        normalizedContent.push(normalizeContentItem(item));
      }
    });

    // Add any toolResults that weren't matched to content items
    // (edge case: toolResult exists but no matching toolCall in parent)
    toolResults.forEach((toolResultEntry: any) => {
      const resultMsg = toolResultEntry.message;
      const toolCallId = resultMsg.toolCallId;

      if (!processedToolCallIds.has(toolCallId)) {
        let contentText = "";
        if (Array.isArray(resultMsg.content)) {
          contentText = resultMsg.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("");
        } else if (typeof resultMsg.content === "string") {
          contentText = resultMsg.content;
        }

        normalizedContent.push({
          type: "tool" as const,
          toolCallId: toolCallId,
          toolName: resultMsg.toolName || "unknown",
          args: {},
          output: resultMsg.isError ? undefined : contentText,
          error: resultMsg.isError ? contentText : undefined,
          status: resultMsg.isError ? "error" : "success",
        });
      }
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

    // If assistant message has usage info, add usage message
    if (msg.role === "assistant" && msg.usage) {
      const usage = msg.usage;
      const inputTokens = usage.input || usage.inputTokens || 0;
      const outputTokens = usage.output || usage.outputTokens || 0;
      const totalTokens = usage.totalTokens || inputTokens + outputTokens;
      const cost = usage.cost?.total ?? (typeof usage.cost === "number" ? usage.cost : 0);

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
