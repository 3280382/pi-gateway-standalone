/**
 * Chat Store - Zustand State Management with Performance Optimizations
 * 使用批量更新和RAF调度优化Streaming message性能
 *
 * 【架构设计说明】
 * 本 Store 是 Chat Feature 的核心状态管理中心。
 *
 * 【数据流】
 * 1. 用户Send message: UI → useChat/useChatController → websocketService.send()
 * 2. 接收AI响应: WebSocket → setupWebSocketListeners() → chatStore (本files)
 * 3. Group件更新: chatStore → React re-render → UI
 *
 * 【特殊设计】
 * - WebSocket 事件处理在 setupWebSocketListeners() (chatApi.ts)
 * - 该处理器直接调用本 Store 的方法Update state，这是 WebSocket 服务的特例
 * - 详情见 chatApi.ts 中的架构注释
 *
 * 【性能优化】
 * - 使用 RAF (requestAnimationFrame) 批量处理Streaming message
 * - 使用 Zustand selectors 避免不必要的重渲染
 * - Tool call使用 Map 存储，支持快速查找
 */

// ===== [ANCHOR:IMPORTS] =====

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { CHAT_STORAGE_KEYS } from "./persist.config";
import type {
  ChatSearchFilters,
  Message,
  SearchResult,
  ToolExecution,
} from "@/features/chat/types/chat";

// ===== [ANCHOR:TYPES] =====

interface ContentPart {
  type: "thinking" | "text" | "tool" | "tool_use" | "turn_marker";
  thinking?: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  partialArgs?: string;
  output?: string;
  error?: string;
  turnNumber?: number;
}

// ===== [ANCHOR:INITIAL_STATE] =====

const createInitialState = () => ({
  messages: [] as Message[],
  currentStreamingMessage: null as Message | null,
  inputText: "",
  isInputFocused: false,
  isStreaming: false,
  isRunning: false, // Pi coding agent turn running status
  streamingContent: "",
  streamingThinking: "",
  streamingThinkings: [] as Array<{ id: string; content: string }>, // 多轮思考支持
  streamingToolCalls: new Map<string, { id: string; name: string; args: string }>(),
  activeTools: new Map<string, ToolExecution>(),
  showThinking: true,
  showTools: true,
  searchQuery: "",
  searchFilters: {
    // Level 1: Message source (user | assistant | sysinfo)
    kind1: {
      user: true,
      assistant: true,
      sysinfo: true,
    },
    // Level 2: Content type (shown based on kind1 selection)
    kind2: {
      prompt: true, // user
      response: true, // assistant
      thinking: true, // assistant
      tool: true, // assistant
      event: true, // sysinfo
    },
    // Level 3: Specific subtypes (shown based on kind2 selection)
    kind3: {
      // System events
      modelChange: true,
      thinkingLevelChange: true,
      compaction: true,
      retry: true,
      autoRetry: true,
      usage: true,
      // Tool statuses
      toolSuccess: true,
      toolError: true,
      toolPending: true,
    },
  },
  searchResults: [] as SearchResult[],
  isSearching: false,
  currentSearchIndex: -1,
  currentModel: null as string | null,
  sessionId: null as string | null,
});

type State = ReturnType<typeof createInitialState>;

// ===== [ANCHOR:HELPERS] =====

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ===== [ANCHOR:CONTENT_BUILDERS] =====

interface ContentPartWithOrder extends ContentPart {
  _order: number;
}

// 内容顺序常量 - 确保相对顺序：thinking < tools < text
const ORDER = {
  THINKING_BASE: 0,
  TOOL_BASE: 100000,
  TEXT_BASE: 200000,
  THINKING_STEP: 1000,
} as const;

/**
 * 构建Thinking content部分 - 只使用当前流式思考，不使用已固化的思考数Group
 * 已固化的思考已经在 existingContent 中
 */
function buildThinkingContent(singleThinking: string): ContentPartWithOrder[] {
  if (!singleThinking) return [];

  return [
    {
      type: "thinking",
      thinking: singleThinking,
      _order: ORDER.THINKING_BASE,
    },
  ];
}

/**
 * 构建文本内容部分
 */
function buildTextContent(textContent: string): ContentPartWithOrder[] {
  if (!textContent) return [];

  return [
    {
      type: "text",
      text: textContent,
      _order: ORDER.TEXT_BASE,
    },
  ];
}

/**
 * 收集工具Items目（已完成和流式中）
 */
function collectToolEntries(state: State): Array<{ tool: any; isCompleted: boolean }> {
  const entries: Array<{ tool: any; isCompleted: boolean }> = [];
  const activeTools = state.activeTools || new Map();
  const streamingToolCalls = state.streamingToolCalls || new Map();

  // 添加已完成的工具
  activeTools.forEach((tool) => {
    entries.push({ tool, isCompleted: true });
  });

  // 添加流式中的工具（只添加没有完成版本的）
  streamingToolCalls.forEach((tool) => {
    if (!activeTools.get(tool.id)) {
      entries.push({ tool, isCompleted: false });
    }
  });

  // 按开始时间Sort
  entries.sort((a, b) => {
    const timeA = a.tool.startTime?.getTime() || 0;
    const timeB = b.tool.startTime?.getTime() || 0;
    return timeA - timeB;
  });

  return entries;
}

/**
 * 构建工具内容部分
 */
function buildToolContent(
  toolEntries: Array<{ tool: any; isCompleted: boolean }>
): ContentPartWithOrder[] {
  return toolEntries.map((entry, index) => {
    const { tool, isCompleted } = entry;
    const baseOrder = ORDER.TOOL_BASE + index;

    if (isCompleted) {
      return {
        type: "tool" as const,
        toolCallId: tool.id,
        toolName: tool.name,
        args: tool.args,
        output: tool.output,
        error: tool.error,
        _order: baseOrder,
      };
    }

    return {
      type: "tool_use" as const,
      toolCallId: tool.id,
      toolName: tool.name,
      partialArgs: tool.args,
      _order: baseOrder,
    };
  });
}

/**
 * 构建内容数Group，保持时序顺序
 * 顺序：thinking -> tools -> text
 * 注意：只构建当前流式内容，已固化的内容在 existingContent 中
 */
function buildContentArray(state: State): ContentPart[] {
  const content: ContentPartWithOrder[] = [
    ...buildThinkingContent(state.streamingThinking),
    ...buildToolContent(collectToolEntries(state)),
    ...buildTextContent(state.streamingContent),
  ];

  // 按顺序Sort并返回（移除 _order 字段）
  return content
    .sort((a, b) => a._order - b._order)
    .map(({ _order, ...rest }) => rest as ContentPart);
}

// ===== [ANCHOR:RAF_SYSTEM] =====

/** 待处理的 RAF 更新 */
interface PendingUpdates {
  content?: string;
  thinking?: string;
  toolCalls?: Map<string, { id: string; name: string; args: string }>;
}

let rafId: number | null = null;
let pendingContentUpdates: PendingUpdates = {};

/**
 * 获取需要保留的内容（已固化的内容块）
 * 保留所有非流式内容块（已固化的 thinking, text, tool_use）
 */
function getPreservedContent(existingContent: any[]): any[] {
  if (!existingContent || existingContent.length === 0) return [];

  // 保留所有已固化的内容（thinking, text, tool_use, tool, turn_marker）
  // 这些是已经通过 endContentBlock 固化的内容
  return existingContent.filter((c: any) =>
    ["thinking", "text", "tool_use", "tool", "turn_marker"].includes(c.type)
  );
}

/**
 * 应用 RAF 批处理更新
 * 只更新流式状态，不操作 currentStreamingMessage.content
 */
function applyRafUpdate(state: State, pending: PendingUpdates): Partial<State> | null {
  if (!state.currentStreamingMessage) return null;

  const newContent = state.streamingContent + (pending.content || "");
  const newThinking = state.streamingThinking + (pending.thinking || "");
  const newToolCalls = pending.toolCalls || state.streamingToolCalls;

  return {
    streamingContent: newContent,
    streamingThinking: newThinking,
    streamingToolCalls: newToolCalls,
  };
}

/**
 * 构建最终消息内容
 * 使用已固化的 existingContent + 剩余流式状态
 *
 * 【工具结果合并】
 * 将 activeTools 中的工具执行结果合并到对应的 tool_use 内容块中
 * 转换为 type: "tool" 以与历史消息格式保持一致
 */
function buildFinalMessage(
  state: State,
  finalContentToApply: string,
  finalThinkingToApply: string
): { finalMessage: any | null; finalContent: any[] } {
  const existingContent = state.currentStreamingMessage?.content || [];
  const activeTools = state.activeTools || new Map();

  // 构建剩余的流式内容（endContentBlock 后可能还有未Clear的）
  const remainingContent: ContentPart[] = [];

  if (state.streamingThinking || finalThinkingToApply) {
    remainingContent.push({
      type: "thinking",
      thinking: state.streamingThinking + finalThinkingToApply,
    });
  }

  (state.streamingToolCalls || new Map()).forEach((tool) => {
    // 查找工具执行结果
    const toolExecution = activeTools.get(tool.id);

    if (toolExecution?.output || toolExecution?.error) {
      // 有结果，转换为 type: "tool" 以匹配历史消息格式
      remainingContent.push({
        type: "tool",
        toolCallId: tool.id,
        toolName: tool.name,
        args: toolExecution.args,
        output: toolExecution.output,
        error: toolExecution.error,
        status: toolExecution.status === "error" ? "error" : "success",
      });
    } else {
      // 无结果，保持 tool_use
      remainingContent.push({
        type: "tool_use",
        toolCallId: tool.id,
        toolName: tool.name,
        partialArgs: tool.args,
      });
    }
  });

  if (state.streamingContent || finalContentToApply) {
    remainingContent.push({
      type: "text",
      text: state.streamingContent + finalContentToApply,
    });
  }

  // 合并已固化内容，并处理已固化内容中的 tool_use（如果后续有结果的话）
  const mergedExistingContent = existingContent.map((block: ContentPart): ContentPart => {
    if (block.type === "tool_use" && block.toolCallId) {
      const toolExecution = activeTools.get(block.toolCallId);
      if (toolExecution?.output || toolExecution?.error) {
        // 转换为 tool 类型，合并结果
        return {
          type: "tool",
          toolCallId: block.toolCallId,
          toolName: block.toolName || toolExecution.name,
          args: toolExecution.args,
          output: toolExecution.output,
          error: toolExecution.error,
          status: toolExecution.status === "error" ? "error" : "success",
        };
      }
    }
    return block;
  });

  const finalContent = [...mergedExistingContent, ...remainingContent];

  const finalMessage = state.currentStreamingMessage
    ? {
        ...state.currentStreamingMessage,
        content: finalContent,
        isStreaming: false,
        isThinkingCollapsed: true,
        isToolsCollapsed: true,
      }
    : null;

  return { finalMessage, finalContent };
}

/**
 * 合并工具Arguments（保留流式Arguments）
 */
function mergeToolArgs(tool: ToolExecution, streamingArgs?: string): Record<string, unknown> {
  return streamingArgs ? { ...tool.args, _streamingArgs: streamingArgs } : tool.args;
}

/**
 * 应用工具激活
 *
 * 【性能优化】
 * 不更新 currentStreamingMessage.content，只更新 activeTools 和 streamingToolCalls。
 * MessageList 通过 activeTools prop 动态渲染工具执行状态，不触发历史消息重渲染。
 *
 * 【设计原则】
 * 工具执行状态与消息内容分离，避免流式过程中的重复渲染
 */
function applyToolActivation(state: State, tool: ToolExecution): Partial<State> {
  const streamingTool = state.streamingToolCalls?.get(tool.id);
  const mergedTool = {
    ...tool,
    args: mergeToolArgs(tool, streamingTool?.args),
  };

  const newTools = new Map(state.activeTools || new Map()).set(tool.id, mergedTool);
  const newStreamingToolCalls = new Map(state.streamingToolCalls || new Map());
  newStreamingToolCalls.delete(tool.id);

  // 优化：不更新 currentStreamingMessage.content，保持引用稳定
  return {
    activeTools: newTools,
    streamingToolCalls: newStreamingToolCalls,
  };
}

/**
 * 应用工具完成
 * 更新 activeTools 中的工具状态，但不替换整个 content
 * 工具显示由 MessageList 根据 activeTools 动态生成
 */
function applyToolCompletion(
  state: State,
  toolId: string,
  output: string,
  error?: string
): Partial<State> {
  const newTools = new Map(state.activeTools || new Map());
  const tool = newTools.get(toolId);

  if (tool) {
    newTools.set(toolId, {
      ...tool,
      output,
      error,
      status: error ? "error" : "success",
      endTime: new Date(),
    });
  }

  // 只更新 activeTools，不修改 currentStreamingMessage.content
  // MessageList 会基于 activeTools 动态渲染Tool result
  return { activeTools: newTools };
}

/**
 * 统一处理流式结束（abort 和 finish）
 */
function finalizeStreaming(
  set: (fn: (state: State) => Partial<State>, replace?: boolean, action?: string) => void,
  actionName: "abortStreaming" | "finishStreaming"
) {
  const finalContentToApply = pendingContentUpdates.content || "";
  const finalThinkingToApply = pendingContentUpdates.thinking || "";
  pendingContentUpdates = {};

  set(
    (state) => {
      const { finalMessage } = buildFinalMessage(state, finalContentToApply, finalThinkingToApply);

      return {
        isStreaming: false,
        messages: finalMessage ? [...state.messages, finalMessage] : state.messages,
        currentStreamingMessage: null,
        streamingContent: "",
        streamingThinking: "",
        streamingThinkings: [],
        streamingToolCalls: new Map(),
        activeTools: new Map(),
      };
    },
    false,
    actionName
  );
}

/**
 * 应用批处理更新
 *
 * 【关键优化 - 性能核心】
 * 流式过程中只更新流式状态（streamingContent, streamingThinking, streamingToolCalls），
 * 不更新 currentStreamingMessage.content。这样可以避免每次流式更新都触发 MessageList 重新渲染。
 *
 * 【数据流设计】
 * 1. 流式更新：只更新流式状态，currentStreamingMessage 引用保持不变
 * 2. MessageList 通过 props 接收流式状态，在 useStreamingMessage hook 中本地合并显示
 * 3. 内容固化：只有在 endContentBlock/finishStreaming 时才将内容添加到 currentStreamingMessage.content
 * 4. 最终保存：流式结束时，currentStreamingMessage 被添加到 messages 数组
 *
 * 【警告】
 * 修改此函数时需特别注意不要重建 currentStreamingMessage 对象，否则会触发不必要的重渲染
 */
function applyBatchUpdates(
  state: State,
  updates: {
    content?: string;
    thinking?: string;
    toolCall?: { id: string; name: string; delta: string };
  }
): Partial<State> {
  let newContent = state.streamingContent;
  let newThinking = state.streamingThinking;
  let newToolCalls = state.streamingToolCalls;

  if (updates.content) {
    newContent += updates.content;
  }

  if (updates.thinking) {
    newThinking += updates.thinking;
  }

  if (updates.toolCall) {
    const { id, name, delta } = updates.toolCall;
    newToolCalls = new Map(newToolCalls);
    const existing = newToolCalls.get(id);
    if (existing) {
      newToolCalls.set(id, { ...existing, args: existing.args + delta });
    } else {
      newToolCalls.set(id, { id, name, args: delta });
    }
  }

  // 优化：只更新流式状态，不更新 currentStreamingMessage.content
  // 这样可以避免每次流式更新都触发 MessageList 重新渲染
  return {
    streamingContent: newContent,
    streamingThinking: newThinking,
    streamingToolCalls: newToolCalls,
    // 保持 currentStreamingMessage 引用不变
    currentStreamingMessage: state.currentStreamingMessage,
  };
}

/**
 * 调度 RAF 更新
 */
function _scheduleRafUpdate(
  getState: () => State,
  set: (fn: (state: State) => Partial<State>, replace?: boolean, action?: string) => void
) {
  if (rafId !== null) return;

  rafId = requestAnimationFrame(() => {
    const state = getState();
    const updates = applyRafUpdate(state, pendingContentUpdates);

    if (updates) {
      set(() => updates, false, "rafBatchUpdate");
    }

    pendingContentUpdates = {};
    rafId = null;
  });
}

// ===== [ANCHOR:STORE] =====

export const useChatStore = create<
  State & {
    // Input Actions
    setInputText: (text: string) => void;
    clearInput: () => void;

    // Message Actions
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    prependMessages: (messages: Message[]) => void; // Load more历史消息时用到
    clearMessages: () => void;

    // Running State (Pi coding agent turn)
    setIsRunning: (isRunning: boolean) => void;

    // Streaming Actions - Batch Updates
    startStreaming: () => void;
    createStreamingMessage: (messageId?: string) => void;
    startNewTurn: () => void;
    startContentBlock: (type: "text" | "thinking" | "tool_use", index?: number, meta?: any) => void;
    endContentBlock: (type: "text" | "thinking" | "tool_use", index?: number, meta?: any) => void;
    batchUpdateContent: (updates: {
      content?: string;
      thinking?: string;
      toolCall?: { id: string; name: string; delta: string };
    }) => void;
    abortStreaming: () => void;
    finishStreaming: () => void;

    // Tool Actions
    setActiveTool: (tool: ToolExecution) => void;
    updateToolOutput: (toolId: string, output: string, error?: string) => void;
    checkToolExecutionStatus: () => string[];

    // UI State
    setShowThinking: (show: boolean) => void;
    setScrollToBottom: (scroll: boolean) => void;

    // Search
    setSearchQuery: (query: string) => void;
    setSearchFilters: (filters: Partial<ChatSearchFilters>) => void;
    setSearchResults: (results: SearchResult[]) => void;
    setSearching: (searching: boolean) => void;

    // Session
    setSessionId: (id: string | null) => void;
    setCurrentModel: (model: string | null) => void;

    // Reset
    reset: () => void;

    // Legacy compatibility
    appendStreamingContent: (text: string) => void;
    appendStreamingThinking: (thinking: string) => void;
    appendToolCallDelta: (id: string, name: string, delta: string) => void;
    updateMessage: (messageId: string, updates: Partial<Message>) => void;
    deleteMessage: (messageId: string) => void;
    toggleMessageCollapse: (messageId: string) => void;
    toggleThinkingCollapse: (messageId: string) => void;
    regenerateMessage: (messageId: string) => void;
    loadSession: (sessionPath: string) => Promise<number>;
  }
>()(
  persist(
    devtools(
      (set, get) => ({
        ...createInitialState(),

        // Input Actions
        setInputText: (text: string) => {
          set({ inputText: text }, false, "setInputText");
        },

        clearInput: () => {
          set({ inputText: "" }, false, "clearInput");
        },

        // Message Actions
        addMessage: (message: Message) => {
          set((state) => ({ messages: [...state.messages, message] }), false, "addMessage");
        },

        setMessages: (messages: Message[]) => {
          console.log("[chatStore.setMessages] Setting messages:", messages.length);
          console.log("[chatStore.setMessages] Current messages before:", get().messages.length);
          set({ messages, currentStreamingMessage: null }, false, "setMessages");
          console.log("[chatStore.setMessages] Current messages after:", get().messages.length);
          console.log("[chatStore.setMessages] Messages set successfully");
        },

        prependMessages: (messages: Message[]) => {
          set(
            (state) => ({ messages: [...messages, ...state.messages] }),
            false,
            "prependMessages"
          );
        },

        clearMessages: () => {
          set({ messages: [] }, false, "clearMessages");
        },

        // Running State (Pi coding agent turn)
        setIsRunning: (isRunning: boolean) => {
          set({ isRunning }, false, "setIsRunning");
        },

        // Streaming Actions - Optimized with batch updates
        startStreaming: () => {
          const streamingMessage: Message = {
            id: generateMessageId(),
            role: "assistant",
            kind1: "assistant",
            kind2: "response",
            kind3: "text_response",
            content: [],
            timestamp: new Date(),
            isStreaming: true,
            isThinkingCollapsed: true, // 默认CollapseThinking content
            isToolsCollapsed: true, // 默认Collapse工具内容
          };
          set(
            {
              isStreaming: true,
              streamingContent: "",
              streamingThinking: "",
              streamingThinkings: [], // Initialize多轮思考
              streamingToolCalls: new Map(),
              activeTools: new Map(), // 清理上一次的工具状态
              currentStreamingMessage: streamingMessage,
            },
            false,
            "startStreaming"
          );
        },

        // 创建Streaming message（使用服务器提供的ID）
        createStreamingMessage: (messageId?: string) => {
          const streamingMessage: Message = {
            id: messageId || generateMessageId(),
            role: "assistant",
            kind1: "assistant",
            kind2: "response",
            kind3: "text_response",
            content: [],
            timestamp: new Date(),
            isStreaming: true,
            isThinkingCollapsed: true,
            isToolsCollapsed: true,
          };
          set(
            {
              isStreaming: true,
              streamingContent: "",
              streamingThinking: "",
              streamingThinkings: [],
              streamingToolCalls: new Map(),
              activeTools: new Map(),
              currentStreamingMessage: streamingMessage,
            },
            false,
            "createStreamingMessage"
          );
        },

        // 开始内容块
        startContentBlock: (type: "text" | "thinking" | "tool_use", index?: number, meta?: any) => {
          console.log(`[ChatStore] startContentBlock: type=${type}, index=${index ?? "?"}`, meta);
          set(
            (state) => {
              if (!state.currentStreamingMessage) return {};

              // 根据类型初始化相应的内容块
              switch (type) {
                case "thinking":
                  // 开始新的思考块
                  return { streamingThinking: "" };
                case "text":
                  // 文本块在 content_delta 时处理
                  return {};
                case "tool_use":
                  // Tool call块在 toolcall_delta 时初始化
                  if (meta?.toolCallId && meta?.toolName) {
                    const newToolCalls = new Map(state.streamingToolCalls);
                    newToolCalls.set(meta.toolCallId, {
                      id: meta.toolCallId,
                      name: meta.toolName,
                      args: "",
                    });
                    return { streamingToolCalls: newToolCalls };
                  }
                  return {};
              }
              return {};
            },
            false,
            "startContentBlock"
          );
        },

        // 结束内容块 - 将流式内容固化到 currentStreamingMessage.content，然后Clear流式状态
        endContentBlock: (type: "text" | "thinking" | "tool_use", index?: number, meta?: any) => {
          console.log(`[ChatStore] endContentBlock: type=${type}, index=${index ?? "?"}`, meta);

          set(
            (state) => {
              if (!state.currentStreamingMessage) return {};

              const existingContent = state.currentStreamingMessage.content || [];
              let newBlock: ContentPart | null = null;
              const updates: Partial<State> = {};

              switch (type) {
                case "thinking":
                  if (state.streamingThinking) {
                    newBlock = {
                      type: "thinking",
                      thinking: state.streamingThinking,
                    };
                    updates.streamingThinking = "";
                  }
                  break;
                case "text":
                  if (state.streamingContent) {
                    newBlock = { type: "text", text: state.streamingContent };
                    updates.streamingContent = "";
                  }
                  break;
                case "tool_use":
                  if (meta?.toolCallId) {
                    const toolCall = state.streamingToolCalls.get(meta.toolCallId);
                    // 检查是否有工具执行结果
                    const toolExecution = state.activeTools?.get(meta.toolCallId);
                    const hasResult = toolExecution?.output || toolExecution?.error;

                    if (toolCall) {
                      if (hasResult) {
                        // 有执行结果，转换为 tool 类型
                        newBlock = {
                          type: "tool",
                          toolCallId: toolCall.id,
                          toolName: toolCall.name,
                          args: toolExecution.args,
                          output: toolExecution.output,
                          error: toolExecution.error,
                          status: toolExecution.status === "error" ? "error" : "success",
                        };
                      } else {
                        // 无结果，保持 tool_use
                        newBlock = {
                          type: "tool_use",
                          toolCallId: toolCall.id,
                          toolName: toolCall.name,
                          partialArgs: toolCall.args,
                        };
                      }
                      const newToolCalls = new Map(state.streamingToolCalls);
                      newToolCalls.delete(meta.toolCallId);
                      updates.streamingToolCalls = newToolCalls;
                    }
                  }
                  break;
              }

              if (newBlock) {
                // Update kind2/kind3 based on content type
                let kind2: Message["kind2"] = "response";
                let kind3: Message["kind3"] = "text_response";

                if (type === "thinking") {
                  kind2 = "thinking";
                  kind3 = "thinking_block";
                } else if (type === "tool_use") {
                  kind2 = "tool";
                  kind3 = "tool_call";
                }

                updates.currentStreamingMessage = {
                  ...state.currentStreamingMessage,
                  content: [...existingContent, newBlock],
                  kind2,
                  kind3,
                };
              }

              return updates;
            },
            false,
            "endContentBlock"
          );
        },

        // 开始新的轮次 - 在 turn_start 时调用
        startNewTurn: () => {
          // Clear RAF 批处理的待处理更新，避免旧内容被重复添加
          pendingContentUpdates = {};

          set(
            (state) => {
              if (!state.currentStreamingMessage) return {};

              // 构建当前轮次的流式内容（未固化的内容）
              const currentStreamingContent = buildContentArray(state);

              // 获取已固化的内容
              const existingContent = state.currentStreamingMessage.content || [];

              // 添加轮次分隔标记（如果当前有流式内容）
              if (currentStreamingContent.length > 0) {
                currentStreamingContent.push({
                  type: "turn_marker",
                  turnNumber:
                    currentStreamingContent.filter((c) => c.type === "turn_marker").length + 1,
                });
              }

              return {
                currentStreamingMessage: {
                  ...state.currentStreamingMessage,
                  // 保留所有已固化内容 + 当前流式内容
                  content: [...existingContent, ...currentStreamingContent],
                },
                // Clear当前轮次的流式状态，开始新一轮
                streamingThinking: "",
                streamingThinkings: [], // Clear多轮思考
                streamingContent: "",
                streamingToolCalls: new Map(),
                // 【重要】保留 activeTools，不在这里清空
                // activeTools 会在 finalizeStreaming 中处理并合并到消息内容
              };
            },
            false,
            "startNewTurn"
          );
        },

        // Batch update - 合并所有更新一次性处理
        batchUpdateContent: (updates: {
          content?: string;
          thinking?: string;
          toolCall?: { id: string; name: string; delta: string };
        }) => {
          const state = get();
          if (!state.currentStreamingMessage) return;

          const newState = applyBatchUpdates(state, updates);

          set(newState, false, "batchUpdateContent");
        },

        // Streaming finalization helpers
        abortStreaming: () => finalizeStreaming(set, "abortStreaming"),
        finishStreaming: () => finalizeStreaming(set, "finishStreaming"),

        // Tools visibility
        showTools: true,
        setShowTools: (show: boolean) => {
          set({ showTools: show }, false, "setShowTools");
        },
        toggleToolsCollapse: (messageId: string) => {
          console.log("[ChatStore] toggleToolsCollapse called:", messageId);
          set(
            (state) => {
              const targetMsg = state.messages.find((m) => m.id === messageId);
              console.log(
                "[ChatStore] Target message found:",
                !!targetMsg,
                "current isToolsCollapsed:",
                targetMsg?.isToolsCollapsed
              );

              const updatedMessages = state.messages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, isToolsCollapsed: msg.isToolsCollapsed === false }
                  : msg
              );
              const updatedMsg = updatedMessages.find((m) => m.id === messageId);
              console.log("[ChatStore] Updated isToolsCollapsed:", updatedMsg?.isToolsCollapsed);

              // 同时更新 currentStreamingMessage
              const updatedStreamingMessage =
                state.currentStreamingMessage?.id === messageId
                  ? {
                      ...state.currentStreamingMessage,
                      isToolsCollapsed: state.currentStreamingMessage.isToolsCollapsed === false,
                    }
                  : state.currentStreamingMessage;
              return {
                messages: updatedMessages,
                currentStreamingMessage: updatedStreamingMessage,
              };
            },
            false,
            "toggleToolsCollapse"
          );
        },
        // Tool Actions
        setActiveTool: (tool: ToolExecution) => {
          set((state) => applyToolActivation(state, tool), false, "setActiveTool");

          // 启动超时检测
          const TOOL_EXECUTION_TIMEOUT = 60000; // 60秒超时
          setTimeout(() => {
            const currentState = get();
            const activeTool = currentState.activeTools.get(tool.id);
            if (activeTool && activeTool.status === "executing" && !activeTool.endTime) {
              // 工具执Rows超时，标记为警告状态
              console.warn(`[ChatStore] Tool execution timeout: ${tool.name} (${tool.id})`);
              set(
                (state) => {
                  const newTools = new Map(state.activeTools);
                  const t = newTools.get(tool.id);
                  if (t && t.status === "executing") {
                    newTools.set(tool.id, {
                      ...t,
                      status: "timeout",
                      error: "工具执Rows超时，可能仍在后台运Rows...",
                    });
                  }
                  return { activeTools: newTools };
                },
                false,
                "toolExecutionTimeout"
              );
            }
          }, TOOL_EXECUTION_TIMEOUT);
        },

        updateToolOutput: (toolId: string, output: string, error?: string) => {
          set(
            (state) => applyToolCompletion(state, toolId, output, error),
            false,
            "updateToolOutput"
          );
        },

        // 检查工具执Rows状态（用于手动触发检查）
        checkToolExecutionStatus: () => {
          const state = get();
          const now = new Date();
          const warnings: string[] = [];

          state.activeTools.forEach((tool) => {
            if (tool.status === "executing" && !tool.endTime) {
              const elapsed = now.getTime() - tool.startTime.getTime();
              const elapsedSeconds = Math.floor(elapsed / 1000);

              if (elapsed > 30000) {
                // 超过30秒
                warnings.push(`${tool.name}: 已执Rows ${elapsedSeconds} 秒`);
              }
            }
          });

          return warnings;
        },

        // UI State
        setShowThinking: (show: boolean) => {
          set({ showThinking: show }, false, "setShowThinking");
        },

        // Search
        setSearchQuery: (query: string) => {
          set({ searchQuery: query }, false, "setSearchQuery");
        },

        setSearchFilters: (filters: Partial<ChatSearchFilters>) => {
          set(
            (state) => ({
              searchFilters: {
                kind1: { ...state.searchFilters.kind1, ...filters.kind1 },
                kind2: { ...state.searchFilters.kind2, ...filters.kind2 },
                kind3: { ...state.searchFilters.kind3, ...filters.kind3 },
                dates: filters.dates ?? state.searchFilters.dates,
              },
            }),
            false,
            "setSearchFilters"
          );
        },

        setSearchResults: (results: SearchResult[]) => {
          set(
            {
              searchResults: results,
              currentSearchIndex: results.length > 0 ? 0 : -1,
            },
            false,
            "setSearchResults"
          );
        },

        setSearching: (searching: boolean) => {
          set({ isSearching: searching }, false, "setSearching");
        },

        nextSearchResult: () => {
          const { searchResults, currentSearchIndex } = get();
          if (searchResults.length === 0) return;
          set(
            {
              currentSearchIndex: (currentSearchIndex + 1) % searchResults.length,
            },
            false,
            "nextSearchResult"
          );
        },

        prevSearchResult: () => {
          const { searchResults, currentSearchIndex } = get();
          if (searchResults.length === 0) return;
          set(
            {
              currentSearchIndex:
                (currentSearchIndex - 1 + searchResults.length) % searchResults.length,
            },
            false,
            "prevSearchResult"
          );
        },

        clearSearch: () => {
          set(
            {
              searchQuery: "",
              searchResults: [],
              currentSearchIndex: -1,
              isSearching: false,
            },
            false,
            "clearSearch"
          );
        },

        // Session
        setSessionId: (id: string | null) => {
          set({ sessionId: id }, false, "setSessionId");
        },

        setCurrentModel: (model: string | null) => {
          set({ currentModel: model }, false, "setCurrentModel");
        },

        // Reset
        reset: () => {
          set(createInitialState(), false, "reset");
        },

        // 直接同步更新流式状态，不用 RAF 批处理避免竞争
        appendStreamingContent: (text: string) => {
          set(
            (state) => ({
              streamingContent: state.streamingContent + text,
            }),
            false,
            "appendStreamingContent"
          );
        },

        appendStreamingThinking: (thinking: string) => {
          set(
            (state) => ({
              streamingThinking: state.streamingThinking + thinking,
            }),
            false,
            "appendStreamingThinking"
          );
        },

        appendToolCallDelta: (id: string, name: string, delta: string) => {
          set(
            (state) => {
              const newToolCalls = new Map(state.streamingToolCalls);
              const existing = newToolCalls.get(id);
              if (existing) {
                newToolCalls.set(id, {
                  ...existing,
                  args: existing.args + delta,
                });
              } else {
                newToolCalls.set(id, { id, name, args: delta });
              }
              return { streamingToolCalls: newToolCalls };
            },
            false,
            "appendToolCallDelta"
          );
        },

        // Message collapse toggle
        toggleMessageCollapse: (messageId: string) => {
          set(
            (state) => ({
              messages: state.messages.map((msg) =>
                msg.id === messageId ? { ...msg, isMessageCollapsed: !msg.isMessageCollapsed } : msg
              ),
            }),
            false,
            "toggleMessageCollapse"
          );
        },

        // Thinking collapse toggle
        toggleThinkingCollapse: (messageId: string) => {
          set(
            (state) => {
              const updatedMessages = state.messages.map((msg) =>
                msg.id === messageId
                  ? { ...msg, isThinkingCollapsed: !msg.isThinkingCollapsed }
                  : msg
              );
              // 同时更新 currentStreamingMessage
              const updatedStreamingMessage =
                state.currentStreamingMessage?.id === messageId
                  ? {
                      ...state.currentStreamingMessage,
                      isThinkingCollapsed: !state.currentStreamingMessage.isThinkingCollapsed,
                    }
                  : state.currentStreamingMessage;
              return {
                messages: updatedMessages,
                currentStreamingMessage: updatedStreamingMessage,
              };
            },
            false,
            "toggleThinkingCollapse"
          );
        },

        // Load session messages from server via HTTP (fallback method)
        // Note: Main loading is now done via WebSocket init for consistency
        loadSession: async (sessionPath: string) => {
          console.log("[ChatStore] loadSession (HTTP fallback) called with path:", sessionPath);
          try {
            const response = await fetch("/api/session/load", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionPath }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error(
                "[ChatStore] Failed to load session:",
                response.status,
                response.statusText,
                errorData
              );
              set({ messages: [] }, false, "loadSession/error");
              return 0;
            }

            const data = await response.json();

            // 使用服务器预处理好的 messages（服务器已处理所有消息格式转换）
            const messages = data.messages || [];
            console.log("[loadSession] Using server-processed messages:", messages.length);
            set({ messages, currentStreamingMessage: null }, false, "loadSession");
            return messages.length;
          } catch (error) {
            console.error("[ChatStore] Error loading session:", error);
            set({ messages: [] }, false, "loadSession/error");
            return 0;
          }
        },

        // Stub methods for compatibility
        updateMessage: () => {},
        deleteMessage: () => {},
        regenerateMessage: () => {},
      }),
      { name: "ChatStore" }
    ),
    {
      name: CHAT_STORAGE_KEYS.CHAT_STORE,
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        searchFilters: state.searchFilters,
      }),
      migrate: (persistedState: unknown) => {
        // Migrate from old flat filter structure to new hierarchical structure
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState;
        }

        const state = persistedState as { searchFilters?: unknown };
        const filters = state.searchFilters;

        // Check if using old flat structure (has 'user' directly instead of 'roles')
        if (filters && typeof filters === "object" && "user" in filters && !("roles" in filters)) {
          const oldFilters = filters as Record<string, boolean>;
          // Convert old flat structure to new hierarchical structure
          return {
            ...state,
            searchFilters: {
              roles: {
                user: oldFilters.user ?? true,
                assistant: oldFilters.assistant ?? true,
                system: oldFilters.system ?? true,
              },
              contentTypes: {
                prompt: oldFilters.user ?? true,
                text: oldFilters.assistant ?? true,
                thinking: oldFilters.thinking ?? true,
                tool: oldFilters.tools ?? true,
                toolSuccess: oldFilters.tools ?? true,
                toolError: oldFilters.tools ?? true,
                toolPending: oldFilters.tools ?? true,
                compaction: oldFilters.compaction ?? true,
                retry: oldFilters.retry ?? true,
                autoRetry: oldFilters.autoRetry ?? true,
                modelChange: oldFilters.modelChange ?? true,
                thinkingLevelChange: oldFilters.thinkingLevelChange ?? true,
                usage: oldFilters.usage ?? true,
              },
            },
          };
        }

        // Migrate from hierarchical structure without tool status filters
        if (
          filters &&
          typeof filters === "object" &&
          "roles" in filters &&
          "contentTypes" in filters
        ) {
          const contentTypes = (filters as any).contentTypes;
          // Add missing tool status filters if not present
          if (contentTypes && typeof contentTypes === "object") {
            const needsMigration = !("toolSuccess" in contentTypes);
            if (needsMigration) {
              return {
                ...state,
                searchFilters: {
                  ...filters,
                  contentTypes: {
                    ...contentTypes,
                    toolSuccess: contentTypes.tool ?? true,
                    toolError: contentTypes.tool ?? true,
                    toolPending: contentTypes.tool ?? true,
                  },
                },
              };
            }
          }
        }

        return persistedState;
      },
    }
  )
);

// ===== [ANCHOR:SELECTORS] =====

export const selectMessages = (state: ReturnType<typeof useChatStore.getState>) => state.messages;
export const selectCurrentStreamingMessage = (state: ReturnType<typeof useChatStore.getState>) =>
  state.currentStreamingMessage;
export const selectInputText = (state: ReturnType<typeof useChatStore.getState>) => state.inputText;
export const selectIsStreaming = (state: ReturnType<typeof useChatStore.getState>) =>
  state.isStreaming;
export const selectIsRunning = (state: ReturnType<typeof useChatStore.getState>) => state.isRunning;
export const selectShowThinking = (state: ReturnType<typeof useChatStore.getState>) =>
  state.showThinking;
export const selectShowTools = (state: ReturnType<typeof useChatStore.getState>) => state.showTools;
export const selectSearchQuery = (state: ReturnType<typeof useChatStore.getState>) =>
  state.searchQuery;
export const selectSearchFilters = (state: ReturnType<typeof useChatStore.getState>) =>
  state.searchFilters;
export const selectSearchResults = (state: ReturnType<typeof useChatStore.getState>) =>
  state.searchResults;
export const selectCurrentSearchIndex = (state: ReturnType<typeof useChatStore.getState>) =>
  state.currentSearchIndex;
export const selectIsSearching = (state: ReturnType<typeof useChatStore.getState>) =>
  state.isSearching;

// Streaming state selectors - passed to MessageList as props to control re-render frequency
export const selectStreamingContent = (state: ReturnType<typeof useChatStore.getState>) =>
  state.streamingContent;
export const selectStreamingThinking = (state: ReturnType<typeof useChatStore.getState>) =>
  state.streamingThinking;
export const selectStreamingToolCalls = (state: ReturnType<typeof useChatStore.getState>) =>
  state.streamingToolCalls;
export const selectActiveTools = (state: ReturnType<typeof useChatStore.getState>) =>
  state.activeTools;

// ===== [ANCHOR:FILTER_HELPERS] =====

export interface FilterOptions {
  query: string;
  filters: ChatSearchFilters;
}

/**
 * Hierarchical Message Type Detection
 *
 * Structure:
 * - Role: user | assistant | system
 *   - User: prompt (text content)
 *   - Assistant: text | thinking | tool
 *   - System: compaction | retry | autoRetry | modelChange | thinkingLevelChange | usage
 */
function detectHierarchicalMessageType(message: Message): {
  role: "user" | "assistant" | "system";
  contentType: string;
} {
  const role = message.role;

  // Determine content type based on role and kind/content
  switch (role) {
    case "user":
      return { role: "user", contentType: "prompt" };

    case "assistant": {
      // Check content array for types
      const hasThinking = message.content.some((c) => c.type === "thinking");
      const hasText = message.content.some((c) => c.type === "text");

      // Check for tools and their statuses
      const toolBlocks = message.content.filter((c) => c.type === "tool" || c.type === "tool_use");
      const hasTool = toolBlocks.length > 0;

      if (hasTool) {
        // Determine tool status for more granular filtering
        // Priority: error > pending > success
        const hasError = toolBlocks.some((c) => c.status === "error" || c.error);
        const hasPending = toolBlocks.some(
          (c) => c.status === "pending" || c.status === "executing"
        );

        if (hasError) return { role: "assistant", contentType: "toolError" };
        if (hasPending) return { role: "assistant", contentType: "toolPending" };
        return { role: "assistant", contentType: "toolSuccess" };
      }

      if (hasThinking) return { role: "assistant", contentType: "thinking" };
      if (hasText) return { role: "assistant", contentType: "text" };
      return { role: "assistant", contentType: "text" }; // default
    }

    case "system": {
      // Use kind field or detect from content
      const kind = message.kind;
      if (kind) {
        // Convert snake_case kind to camelCase for contentTypes lookup
        const camelKind = kind.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        return { role: "system", contentType: camelKind };
      }

      // Fallback: detect from text content
      const text = message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join(" ");

      if (text.includes("🗜️ Compacting") || text.includes("上下文压缩")) {
        return { role: "system", contentType: "compaction" };
      }
      if (text.includes("🔄 Auto-retrying")) {
        return { role: "system", contentType: "autoRetry" };
      }
      if (text.includes("🔄 Retrying")) {
        return { role: "system", contentType: "retry" };
      }
      if (text.includes("模型已切换为") || text.includes("Model switched")) {
        return { role: "system", contentType: "modelChange" };
      }
      if (text.includes("Thinking level") || text.includes("Thinking level已设置")) {
        return { role: "system", contentType: "thinkingLevelChange" };
      }
      if (text.includes("📊") || text.includes("tokens") || text.includes("cost")) {
        return { role: "system", contentType: "usage" };
      }

      return { role: "system", contentType: "unknown" };
    }

    default:
      return { role: "system", contentType: "unknown" };
  }
}

/**
 * Hierarchical Message Filtering
 *
 * Two-level filtering:
 * 1. Role level: user | assistant | system
 * 2. Content type level: depends on role
 *
 * @param messages Array of messages
 * @param options Filter options with hierarchical structure
 * @returns Filtered messages
 */
export function filterMessages(messages: Message[], options: FilterOptions): Message[] {
  const { query, filters } = options;
  const lowerQuery = query.toLowerCase().trim();

  // Defensive: ensure filters has the expected structure
  const safeFilters = {
    roles: filters?.roles ?? { user: true, assistant: true, system: true },
    contentTypes: filters?.contentTypes ?? {
      prompt: true,
      text: true,
      thinking: true,
      tool: true,
      toolSuccess: true,
      toolError: true,
      toolPending: true,
      compaction: true,
      retry: true,
      autoRetry: true,
      modelChange: true,
      thinkingLevelChange: true,
      usage: true,
    },
  };

  return messages.filter((message) => {
    const { role, contentType } = detectHierarchicalMessageType(message);

    // Level 1: Role filtering
    if (!safeFilters.roles[role]) return false;

    // Level 2: Content type filtering (role-specific)
    switch (role) {
      case "user":
        // User messages are always "prompt" type
        if (!safeFilters.contentTypes.prompt) return false;
        break;

      case "assistant": {
        // Assistant messages can be: text, thinking, tool (with status variants)
        // First check if the base type is enabled
        if (contentType === "text" && !safeFilters.contentTypes.text) return false;
        if (contentType === "thinking" && !safeFilters.contentTypes.thinking) return false;

        // For tools, check both base "tool" and specific status filters
        if (contentType.startsWith("tool")) {
          // If base tool filter is off, hide all tools
          if (!safeFilters.contentTypes.tool) return false;

          // Check specific tool status filters
          if (contentType === "toolSuccess" && !safeFilters.contentTypes.toolSuccess) return false;
          if (contentType === "toolError" && !safeFilters.contentTypes.toolError) return false;
          if (contentType === "toolPending" && !safeFilters.contentTypes.toolPending) return false;
        }
        break;
      }

      case "system": {
        // System messages are special events
        if (contentType === "unknown") {
          // Unknown system messages are shown if system role is enabled
          return true;
        }
        const typeKey = contentType as keyof typeof safeFilters.contentTypes;
        if (!safeFilters.contentTypes[typeKey]) return false;
        break;
      }
    }

    // Level 3: Text search filtering (if query exists)
    if (lowerQuery) {
      const messageText = message.content
        .map((c) => {
          if (c.type === "text") return c.text || "";
          if (c.type === "thinking") return c.thinking || "";
          if (c.type === "tool" || c.type === "tool_use") {
            return `${c.toolName || ""} ${JSON.stringify(c.args || {})} ${c.output || ""}`;
          }
          return "";
        })
        .join(" ")
        .toLowerCase();

      return messageText.includes(lowerQuery);
    }

    return true;
  });
}

/**
 * Selector: 获取过滤后的消息
 */
export const selectFilteredMessages = (options: FilterOptions) => {
  return (state: ReturnType<typeof useChatStore.getState>): Message[] => {
    return filterMessages(state.messages, options);
  };
};
