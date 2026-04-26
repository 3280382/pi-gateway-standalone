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
import type {
  ChatSearchFilters,
  Message,
  SearchResult,
  ToolExecution,
} from "@/features/chat/types/chat";
import { CHAT_STORAGE_KEYS } from "./persist.config";

// ===== [ANCHOR:TYPES] =====

interface ContentPart {
  type: "thinking" | "text" | "tool" | "tool_use" | "turn_marker" | "image";
  thinking?: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  partialArgs?: string;
  output?: string;
  error?: string;
  status?: string;
  imageUrl?: string;
  turnNumber?: number;
}

// ===== [ANCHOR:INITIAL_STATE] =====

const createInitialState = () => ({
  messages: [] as Message[],
  currentStreamingMessage: null as Message | null,
  inputText: "",
  isStreaming: false,
  isRunning: false, // Pi coding agent turn running status
  isReconnecting: false, // WebSocket reconnection in progress
  pendingUserMessage: null as Message | null, // pessimistic send buffer
  queueState: { steering: [] as string[], followUp: [] as string[] }, // queue_update
  streamingContent: "",
  streamingThinking: "",
  streamingThinkings: [] as Array<{ id: string; content: string }>, // 多轮思考支持
  streamingToolCalls: new Map<string, { id: string; name: string; args: string }>(),
  activeTools: new Map<string, ToolExecution>(),
  showThinking: true,
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
    dates: undefined as { from?: Date; to?: Date } | undefined,
  },
  searchResults: [] as SearchResult[],
  isSearching: false,
  currentSearchIndex: -1,
});

type State = ReturnType<typeof createInitialState>;

// ===== [ANCHOR:HELPERS] =====

export function generateMessageId(): string {
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

let pendingContentUpdates: PendingUpdates = {};

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
  const existingContent: ContentPart[] = (state.currentStreamingMessage?.content ||
    []) as ContentPart[];
  const activeTools = state.activeTools || new Map();

  // 收集已固化内容中已有的 toolCallId，避免重复
  const existingToolIds = new Set<string>();
  existingContent.forEach((block: ContentPart) => {
    if ((block.type === "tool_use" || block.type === "tool") && block.toolCallId) {
      existingToolIds.add(block.toolCallId);
    }
  });

  // 构建剩余的流式内容（endContentBlock 后可能还有未Clear的）
  const remainingContent: ContentPart[] = [];

  if (state.streamingThinking || finalThinkingToApply) {
    remainingContent.push({
      type: "thinking",
      thinking: state.streamingThinking + finalThinkingToApply,
    });
  }

  (state.streamingToolCalls || new Map()).forEach((tool) => {
    // 跳过已在 existingContent 中固化的工具
    if (existingToolIds.has(tool.id)) return;

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
function finalizeStreaming(set: any, actionName: "abortStreaming" | "finishStreaming") {
  const finalContentToApply = pendingContentUpdates.content || "";
  const finalThinkingToApply = pendingContentUpdates.thinking || "";
  pendingContentUpdates = {};

  set(
    (state: State) => {
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

// ===== [ANCHOR:STORE] =====

export const useChatStore = create<
  State & {
    // Input Actions
    setInputText: (text: string) => void;
    clearInput: () => void;

    // Message Actions
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;

    clearMessages: () => void;

    // Running State (Pi coding agent turn)
    setIsRunning: (isRunning: boolean) => void;
    setReconnecting: (v: boolean) => void;

    // Pessimistic sending
    setPendingUserMessage: (msg: Message) => void;
    commitPendingMessage: () => void; // deprecated, use confirmSend
    confirmSend: () => void;
    // Queue state for UI badges
    setQueueState: (qs: { steering: string[]; followUp: string[] }) => void;

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

    // Reset
    reset: () => void;

    // Legacy compatibility
    appendStreamingContent: (text: string) => void;
    appendStreamingThinking: (thinking: string) => void;
    appendToolCallDelta: (id: string, name: string, delta: string) => void;
    toggleMessageCollapse: (messageId: string) => void;
    toggleThinkingCollapse: (messageId: string) => void;
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

        clearMessages: () => {
          set({ messages: [] }, false, "clearMessages");
        },

        // Running State (Pi coding agent turn)
        setIsRunning: (isRunning: boolean) => {
          set({ isRunning }, false, "setIsRunning");
        },
        setReconnecting: (v: boolean) => set({ isReconnecting: v }),

        // Pessimistic sending - cache user message until turn_start confirms
        setPendingUserMessage: (msg: Message) => set({ pendingUserMessage: msg }),
        commitPendingMessage: () => {
          const { pendingUserMessage: msg } = useChatStore.getState();
          if (!msg) return; // not a user-typed message, skip
          useChatStore.setState({ pendingUserMessage: null, inputText: "" });
          useChatStore.getState().startStreaming();
        },
        confirmSend: function () {
          const state = useChatStore.getState();
          if (state.pendingUserMessage) {
            useChatStore.setState({ pendingUserMessage: null, inputText: "" });
          }
          if (!state.isStreaming) {
            useChatStore.getState().startStreaming();
          }
        },
        setQueueState: (qs: { steering: string[]; followUp: string[] }) => set({ queueState: qs }),

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

              const existingContent: ContentPart[] = (state.currentStreamingMessage.content ||
                []) as ContentPart[];
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
                  content: [...existingContent, newBlock as ContentPart] as any,
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
              const existingContent: ContentPart[] = (state.currentStreamingMessage.content ||
                []) as ContentPart[];

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
                  content: [...existingContent, ...currentStreamingContent] as any,
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
          // Note: Tool execution timeout is handled by server, client just waits
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
            (state: any) => {
              // Ensure default values if fields are undefined (migration safety)
              const defaultKind1 = { user: true, assistant: true, sysinfo: true };
              const defaultKind2 = {
                prompt: true,
                response: true,
                thinking: true,
                tool: true,
                event: true,
              };
              const defaultKind3 = {
                modelChange: true,
                thinkingLevelChange: true,
                compaction: true,
                retry: true,
                autoRetry: true,
                usage: true,
                toolSuccess: true,
                toolError: true,
                toolPending: true,
              };
              return {
                searchFilters: {
                  kind1: { ...defaultKind1, ...state.searchFilters?.kind1, ...filters.kind1 },
                  kind2: { ...defaultKind2, ...state.searchFilters?.kind2, ...filters.kind2 },
                  kind3: { ...defaultKind3, ...state.searchFilters?.kind3, ...filters.kind3 },
                  dates: (filters as any).dates ?? state.searchFilters?.dates,
                },
              };
            },
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

        // Session

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
export const selectIsReconnecting = (state: ReturnType<typeof useChatStore.getState>) =>
  state.isReconnecting;
export const selectShowThinking = (state: ReturnType<typeof useChatStore.getState>) =>
  state.showThinking;
export const selectSearchQuery = (state: ReturnType<typeof useChatStore.getState>) =>
  state.searchQuery;
export const selectSearchFilters = (state: ReturnType<typeof useChatStore.getState>) =>
  state.searchFilters;
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
 * Hierarchical Message Filtering - 3-Level Kind System
 *
 * Three-level filtering:
 * 1. Kind1 (Source): user | assistant | sysinfo
 * 2. Kind2 (Category): prompt | response | thinking | tool | event
 * 3. Kind3 (Subtype): model_change | thinking_level_change | compaction | retry | auto_retry | usage | toolSuccess | toolError | toolPending
 *
 * @param messages Array of messages
 * @param options Filter options with hierarchical structure
 * @returns Filtered messages
 */
export function filterMessages(messages: Message[], options: FilterOptions): Message[] {
  const { query, filters } = options;
  const lowerQuery = query.toLowerCase().trim();

  // Defensive: ensure filters has the expected structure (new 3-level kind system)
  const safeFilters = {
    kind1: filters?.kind1 ?? { user: true, assistant: true, sysinfo: true },
    kind2: filters?.kind2 ?? {
      prompt: true,
      response: true,
      thinking: true,
      tool: true,
      event: true,
    },
    kind3: filters?.kind3 ?? {
      modelChange: true,
      thinkingLevelChange: true,
      compaction: true,
      retry: true,
      autoRetry: true,
      usage: true,
      toolSuccess: true,
      toolError: true,
      toolPending: true,
    },
  };

  return messages.filter((message) => {
    // Use message's kind1/kind2/kind3 fields directly (from server)
    // Fallback for messages without kind fields (e.g. user-created messages)
    let kind1 = message.kind1;
    let kind2 = message.kind2;
    const kind3 = message.kind3;

    // Infer kind1/kind2 from role for backward compatibility
    if (!kind1 && message.role) {
      if (message.role === "user") kind1 = "user";
      else if (message.role === "assistant") kind1 = "assistant";
      else if (message.role === "system") kind1 = "sysinfo";
    }
    if (!kind2 && kind1) {
      if (kind1 === "user") kind2 = "prompt";
      else if (kind1 === "assistant") kind2 = "response";
      else if (kind1 === "sysinfo") kind2 = "event";
    }

    // Level 1: Kind1 filtering (user | assistant | sysinfo)
    if (!kind1 || !safeFilters.kind1[kind1]) return false;

    // Level 2: Kind2 filtering (prompt | response | thinking | tool | event)
    // Also check message content blocks to ensure 1:1 filtering
    if (!kind2 || !safeFilters.kind2[kind2]) return false;

    // Content-level filtering for assistant messages:
    // Only intercept when a message's kind2 does NOT cover a disabled content type it contains.
    // Prevents misclassified messages (e.g. kind2=tool but contains thinking) from escaping.
    if (kind1 === "assistant" && message.content?.length) {
      const contentTypes = new Set(message.content.map((c) => c.type));
      const hasThinking = contentTypes.has("thinking");
      const hasTool = contentTypes.has("tool") || contentTypes.has("tool_use");

      if (kind2 === "tool" && hasThinking && !safeFilters.kind2.thinking) return false;
      if (kind2 === "thinking" && hasTool && !safeFilters.kind2.tool) return false;
      if (kind2 === "response" && hasThinking && !safeFilters.kind2.thinking) return false;
      if (kind2 === "response" && hasTool && !safeFilters.kind2.tool) return false;
    }

    // Level 3: Kind3 filtering for specific subtypes
    if (kind3) {
      // Map snake_case kind3 to camelCase for filter lookup
      const camelKind3 = kind3.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

      // For sysinfo events, check specific event type filters
      if (kind1 === "sysinfo" && kind2 === "event") {
        const eventFilters = [
          "modelChange",
          "thinkingLevelChange",
          "compaction",
          "retry",
          "autoRetry",
          "usage",
        ];
        if (
          eventFilters.includes(camelKind3) &&
          !safeFilters.kind3[camelKind3 as keyof typeof safeFilters.kind3]
        ) {
          return false;
        }
      }

      // For tool messages, check tool status filters
      if (
        kind2 === "tool" ||
        kind3 === "tool_call" ||
        kind3 === "tool_result" ||
        kind3 === "tool_success" ||
        kind3 === "tool_error"
      ) {
        // Check if base tool filter is enabled
        if (!safeFilters.kind2.tool) return false;

        // Determine tool status from message content
        const toolBlocks =
          message.content?.filter((c) => c.type === "tool" || c.type === "tool_use") || [];

        if (toolBlocks.length > 0) {
          // Check if any tool passes the status filter
          const hasVisibleTool = toolBlocks.some((block) => {
            const status = block.error ? "error" : block.output ? "success" : "pending";
            const statusKey =
              `tool${status.charAt(0).toUpperCase() + status.slice(1)}` as keyof typeof safeFilters.kind3;
            return safeFilters.kind3[statusKey] ?? true;
          });

          if (!hasVisibleTool) return false;
        }
      }
    }

    // Level 4: Text search filtering (if query exists)
    if (lowerQuery) {
      const messageText =
        message.content
          ?.map((c) => {
            if (c.type === "text") return c.text || "";
            if (c.type === "thinking") return c.thinking || "";
            if (c.type === "tool" || c.type === "tool_use") {
              return `${c.toolName || ""} ${JSON.stringify(c.args || {})} ${c.output || ""}`;
            }
            return "";
          })
          .join(" ")
          .toLowerCase() || "";

      return messageText.includes(lowerQuery);
    }

    return true;
  });
}
