/**
 * Session Message Processor - New version with 3-level classification
 *
 * Kind1: user | ai | system
 * Kind2: prompt | response | thinking | tool | event
 * Kind3: specific subtype
 */

import type {
  Message,
  MessageKind1,
  MessageKind2,
  MessageKind3,
} from "../../../shared/types/session-messages.types";

interface SessionEntry {
  type: string;
  id?: string;
  parentId?: string;
  timestamp?: string;
  message?: {
    role: string;
    content: any;
    toolCallId?: string;
    toolName?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Determine kind3 (specific subtype) from entry
 */
function detectKind3(entry: SessionEntry, msg?: any): MessageKind3 {
  // System events from special entry types
  if (entry.type === "model_change") return "model_change";
  if (entry.type === "thinking_level_change") return "thinking_level_change";
  if (entry.type === "compaction") return "compaction";
  if (entry.type === "usage") return "usage";

  // Detect from message content for system messages
  if (msg?.role === "system") {
    const text =
      msg.content
        ?.filter((c: any) => c.type === "text")
        .map((c: any) => c.text || "")
        .join(" ") || "";

    if (text.includes("🗜️") || text.includes("Context compaction")) return "compaction";
    if (text.includes("🔄") && text.includes("Auto")) return "auto_retry";
    if (text.includes("🔄")) return "retry";
    if (text.includes("🤖") || text.includes("Model switched")) return "model_change";
    if (text.includes("🧠") || text.includes("Thinking level")) return "thinking_level_change";
    if (text.includes("📊") || text.includes("Usage:")) return "usage";
    if (text.includes("💰") || text.includes("Cost:")) return "usage";
  }

  // AI message types
  if (msg?.role === "assistant") {
    if (msg.content?.some((c: any) => c.type === "thinking")) return "thinking_block";
    return "text_response";
  }

  // User message types
  if (msg?.role === "user") {
    return "text_prompt";
  }

  return undefined;
}

/**
 * Build the three-level classification
 */
function buildClassification(
  entry: SessionEntry,
  msg?: any
): { kind1: MessageKind1; kind2: MessageKind2; kind3?: MessageKind3; role: string; kind?: string } {
  const kind3 = detectKind3(entry, msg);

  // Sysinfo events (system info, not API system role)
  if (entry.type !== "message" || msg?.role === "system") {
    return {
      kind1: "sysinfo",
      kind2: "event",
      kind3,
      role: "system",
      kind: kind3,
    };
  }

  // User messages
  if (msg?.role === "user") {
    return {
      kind1: "user",
      kind2: "prompt",
      kind3: "text_prompt",
      role: "user",
      kind: "text_prompt",
    };
  }

  // Assistant messages
  if (msg?.role === "assistant") {
    const hasThinking = msg.content?.some((c: any) => c.type === "thinking");
    const hasTool = msg.content?.some((c: any) => c.type === "toolCall" || c.type === "tool_use");

    if (hasTool) {
      return {
        kind1: "assistant",
        kind2: "tool",
        kind3: "tool_call",
        role: "assistant",
        kind: "tool_call",
      };
    }

    if (hasThinking) {
      return {
        kind1: "assistant",
        kind2: "thinking",
        kind3: "thinking_block",
        role: "assistant",
        kind: "thinking_block",
      };
    }

    return {
      kind1: "assistant",
      kind2: "response",
      kind3: "text_response",
      role: "assistant",
      kind: "text_response",
    };
  }

  // Default (sysinfo for system events)
  return {
    kind1: "sysinfo",
    kind2: "event",
    kind3,
    role: "system",
    kind: kind3,
  };
}

/**
 * Normalize content array
 */
function normalizeContent(rawContent: any): any[] {
  if (!rawContent) return [];
  if (Array.isArray(rawContent)) return [...rawContent];
  if (typeof rawContent === "string") {
    return [{ type: "text", text: rawContent }];
  }
  return [rawContent];
}

/**
 * Convert special entry types to messages
 */
function convertSpecialEntryToMessage(
  entry: SessionEntry,
  classification: {
    kind1: MessageKind1;
    kind2: MessageKind2;
    kind3?: MessageKind3;
    role: string;
    kind?: string;
  }
): Message | null {
  const baseMessage: Message = {
    id: entry.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    kind1: classification.kind1,
    kind2: classification.kind2,
    kind3: classification.kind3,
    role: classification.role as Message["role"],
    kind: classification.kind as Message["kind"],
    content: [],
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
        content: [{ type: "text" as const, text: `Model: ${entry.provider}/${entry.modelId}` }],
      };
    case "thinking_level_change":
      return {
        ...baseMessage,
        id: entry.id || `thinking-${Date.now()}`,
        content: [{ type: "text" as const, text: `Thinking: ${entry.thinkingLevel}` }],
      };
    case "compaction":
      return {
        ...baseMessage,
        id: entry.id || `compact-${Date.now()}`,
        content: [
          {
            type: "text" as const,
            text: `Compaction: ${entry.summary || "Context compressed"}${entry.tokensBefore ? ` (-${entry.tokensBefore} tokens)` : ""}`,
          },
        ],
      };
    case "usage": {
      const u = entry.usage;
      const tokens = u?.totalTokens || (u?.inputTokens || 0) + (u?.outputTokens || 0);
      const cost = u?.cost || u?.estimatedCost || 0;
      return {
        ...baseMessage,
        id: entry.id || `usage-${Date.now()}`,
        content: [
          {
            type: "text" as const,
            text: `Usage: ${tokens.toLocaleString()} tokens${cost ? ` ($${cost.toFixed(4)})` : ""}${u?.model ? ` · ${u.model}` : ""}`,
          },
        ],
      };
    }
    default:
      return null;
  }
}

/**
 * Find tool call in message content by ID
 */
function findToolCallInMessage(message: Message, toolCallId: string): any | null {
  if (!message.content || !Array.isArray(message.content)) return null;

  for (const block of message.content as any[]) {
    // Check for toolCall type (used in JSONL) - raw data from JSONL has 'id' field
    if (
      (block.type === "toolCall" || block.type === "tool_use") &&
      (block.id === toolCallId || block.toolCallId === toolCallId)
    ) {
      return block;
    }
  }
  return null;
}

/**
 * Update tool call block with result
 */
function updateToolCallWithResult(
  content: any[],
  toolCallId: string,
  result: any,
  isError: boolean
): any[] {
  return content.map((block) => {
    // Match by id (toolCall) or toolCallId
    if ((block.type === "toolCall" || block.type === "tool_use") && block.id === toolCallId) {
      return {
        ...block,
        type: "tool", // Convert to combined tool type
        toolName: block.name || block.toolName, // Map name to toolName for client
        toolCallId: block.id, // Ensure toolCallId is set
        output: result,
        error: isError ? result : undefined,
        status: isError ? "error" : "success",
      };
    }
    return block;
  });
}

/**
 * Process session entries with 3-level classification
 *
 * Tool Result Association Logic:
 * - When processing toolResult entries, we look for the matching toolCall
 *   in the CURRENT message (not globally) because tool IDs can repeat
 * - We track the last assistant message as "current message"
 * - Tool results are merged into their corresponding tool calls
 */
export function processSessionEntries(entries: SessionEntry[]): {
  entries: SessionEntry[];
  messages: Message[];
} {
  const messages: Message[] = [];
  let currentMessage: Message | null = null;

  for (const entry of entries) {
    // Handle special entry types (system events)
    if (entry.type !== "message") {
      const classification = buildClassification(entry);
      const specialMessage = convertSpecialEntryToMessage(entry, classification);
      if (specialMessage) {
        messages.push(specialMessage);
        currentMessage = null; // System events don't have tool calls
      }
      continue;
    }

    const msg = entry.message;
    if (!msg) continue;

    // Handle tool results - merge into current message's tool call
    if (msg.role === "toolResult") {
      const toolCallId = msg.toolCallId;
      const toolName = msg.toolName;

      if (currentMessage && toolCallId) {
        // Find the tool call in current message
        const toolCall = findToolCallInMessage(currentMessage, toolCallId);

        if (toolCall) {
          // Extract result from content
          const resultContent = msg.content;
          let resultText = "";
          if (Array.isArray(resultContent)) {
            resultText = resultContent
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("\n");
          } else if (typeof resultContent === "string") {
            resultText = resultContent;
          }

          // Update the tool call with result
          currentMessage.content = updateToolCallWithResult(
            currentMessage.content,
            toolCallId,
            resultText,
            msg.isError || false
          );

          // Also update in messages array
          const msgIndex = messages.findIndex((m) => m.id === currentMessage!.id);
          if (msgIndex >= 0) {
            messages[msgIndex] = { ...currentMessage };
          }
        }
      }
      continue; // Don't create separate message for toolResult
    }

    // Build classification for regular messages
    const classification = buildClassification(entry, msg);

    // Normalize content and convert toolCall fields for client compatibility
    let contentArray = normalizeContent(msg.content).map((block: any) => {
      // Convert toolCall to tool_use and map fields for client
      if (block.type === "toolCall") {
        return {
          ...block,
          type: "tool_use",
          toolName: block.name || block.toolName,
          toolCallId: block.id,
          args: block.arguments, // Map arguments to args for client
        };
      }
      return block;
    });

    const message: Message = {
      id: entry.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      kind1: classification.kind1,
      kind2: classification.kind2,
      kind3: classification.kind3,
      role: classification.role as any,
      kind: classification.kind as any,
      content: contentArray,
      timestamp: new Date(entry.timestamp || Date.now()),
      usage: msg.usage,
      model: msg.model,
      provider: msg.provider,
      stopReason: msg.stopReason,
      isStreaming: false,
      isThinkingCollapsed: true,
      isToolsCollapsed: true,
      isMessageCollapsed: false,
    };

    messages.push(message);

    // Track assistant messages as current message for tool result association
    if (classification.kind1 === "assistant") {
      currentMessage = message;
    } else {
      currentMessage = null;
    }

    // Extract usage from assistant messages and create separate usage message
    if (classification.kind1 === "assistant" && msg.usage) {
      const u = msg.usage;
      const tokens = u.totalTokens || (u.inputTokens || 0) + (u.outputTokens || 0);
      const costValue = u.cost?.total || u.cost?.input || 0;
      const cost = typeof costValue === "number" ? costValue : parseFloat(costValue) || 0;

      // Build usage text - header shows key info, details in content
      const inputTokens = u.inputTokens || u.input || 0;
      const outputTokens = u.outputTokens || u.output || 0;
      const headerText = `${tokens.toLocaleString()} tokens · ${inputTokens} in / ${outputTokens} out${cost ? ` · $${cost.toFixed(4)}` : ""}`;

      const detailLines = [
        `Input: ${inputTokens}`,
        `Output: ${outputTokens}`,
        `Cache Read: ${u.cacheRead || 0}`,
        `Cache Write: ${u.cacheWrite || 0}`,
        `Total: ${u.totalTokens || tokens}`,
      ];
      if (cost) detailLines.push(`Cost: $${cost.toFixed(6)}`);
      if (u.model) detailLines.push(`Model: ${u.model}`);

      const fullText = `${headerText}\n\n${detailLines.join("\n")}`;

      const usageMessage: Message = {
        id: `usage-${entry.id || Date.now()}`,
        kind1: "sysinfo",
        kind2: "event",
        kind3: "usage",
        role: "system",
        kind: "usage",
        content: [{ type: "text" as const, text: fullText }],
        timestamp: new Date(entry.timestamp || Date.now()),
        isStreaming: false,
        isThinkingCollapsed: true,
        isToolsCollapsed: true,
        isMessageCollapsed: false,
      };
      messages.push(usageMessage);
    }
  }

  return { entries, messages };
}
