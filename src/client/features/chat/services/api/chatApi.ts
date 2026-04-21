/**
 * Enhanced Chat API - 完整整合所有WebSocket功能
 * 连接Zustand Store与后端WebSocket，实现所有后端支持的功能
 */

// 【工具执行信息存储】用于在孤立工具结果时获取工具名称和参数
const executingTools = new Map<string, { name: string; args: any }>();

import {
  abortChatGeneration,
  compactSession,
  executeChatCommand,
  exportSession,
  initChatWorkingDirectory,
  listChatModels,
  sendChatMessage,
  setChatLlmLogEnabled,
  setChatModel,
  setChatThinkingLevel,
  steerChat,
  switchChatSession,
} from "@/features/chat/services/chatWebSocket";
import { messageReconstructor } from "@/features/chat/services/messageReconstruction";
import { sessionManager, updateSessionsAndStatus } from "@/features/chat/services/sessionManager";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { ChatController, Message, ToolExecution } from "@/features/chat/types/chat";
import { websocketService } from "@/services/websocket.service";

// ============================================================================
// Message ID Generator
// ============================================================================

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateToolId(): string {
  return `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Enhanced Chat Controller Interface (扩展原有接口)
// ============================================================================

export interface EnhancedChatController extends ChatController {
  // 扩展功能
  steer: (text: string) => void;
  createNewSession: () => Promise<void>;
  loadSession: (sessionPath: string) => Promise<void>;

  setModel: (modelId: string, thinkingLevel?: string) => Promise<void>;
  setThinkingLevel: (level: string) => Promise<void>;
  listModels: () => Promise<any>;
  executeCommand: (command: string) => Promise<any>;
  compactSession: (customInstructions?: string) => Promise<any>;
  exportSession: (outputPath?: string) => Promise<any>;
  setLlmLogEnabled: (enabled: boolean) => Promise<void>;
  changeWorkingDir: (path: string) => Promise<void>;
}

// ============================================================================
// Promise Helper
// ============================================================================

interface PromiseConfig<T> {
  timeoutMs?: number;
  timeoutMessage: string;
  eventName: string;
  onSuccess: (data: T) => void;
  sendAction: () => void;
}

function createPromiseWithTimeout<T>({
  timeoutMs = 5000,
  timeoutMessage,
  eventName,
  onSuccess,
  sendAction,
}: PromiseConfig<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    const unsubscribe = websocketService.on(eventName, (data: T) => {
      clearTimeout(timeout);
      onSuccess(data);
      unsubscribe();
      resolve(data);
    });

    sendAction();
  });
}

// ============================================================================
// Controller Hook
// ============================================================================

export function useChatController(): EnhancedChatController {
  const chatStore = useChatStore();
  const sessionStore = useSessionStore();

  // 注意：全局流式处理器由 setupWebSocketListeners() 统一设置
  // 在应用初始化时调用一次，这里不再重复设置，避免消息重复处理

  return {
    // 基础聊天功能（支持图片）
    sendMessage: async (
      text: string,
      images?: Array<{
        type: "image";
        source: { type: "base64"; mediaType: string; data: string };
      }>
    ) => {
      if (!text.trim() && (!images || images.length === 0)) return Promise.resolve();

      // 检查WebSocket连接状态
      if (!websocketService.isConnected) {
        console.error("[ChatAPI] WebSocket not connected, attempting to connect...");
        try {
          await websocketService.connect();
        } catch (error) {
          console.error("[ChatAPI] Failed to connect WebSocket:", error);
          throw new Error("无法连接到服务器，请检查网络连接");
        }
      }

      // 构建消息内容（文本 + 图片）
      const content: Message["content"] = [{ type: "text", text }];
      if (images && images.length > 0) {
        content.push(
          ...images.map((img) => ({
            type: "image" as const,
            imageUrl: `data:${img.source.mediaType};base64,${img.source.data}`,
          }))
        );
      }

      // 添加User message
      const userMessage: Message = {
        id: generateMessageId(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      chatStore.addMessage(userMessage);
      chatStore.clearInput();
      chatStore.startStreaming();

      // 通过WebSocketSend message
      const success = sendChatMessage(text, undefined, undefined, images);

      if (!success) {
        chatStore.abortStreaming();
        throw new Error("Failed to send message, please retry");
      }
    },

    abortGeneration: () => {
      abortChatGeneration();
      chatStore.abortStreaming();
    },

    steer: (text: string) => {
      if (!text.trim()) return;

      // 添加User message到Cols表（类似 sendMessage）
      const userMessage: Message = {
        id: generateMessageId(),
        role: "user",
        content: [{ type: "text", text: text.trim() }],
        timestamp: new Date(),
      };
      chatStore.addMessage(userMessage);
      chatStore.clearInput();

      steerChat(text);
    },

    // 输入控制
    setInputText: (text: string) => {
      chatStore.setInputText(text);
    },

    clearInput: () => {
      chatStore.clearInput();
    },

    // 消息操作
    toggleMessageCollapse: (messageId: string) => {
      chatStore.toggleMessageCollapse(messageId);
    },

    toggleThinkingCollapse: (messageId: string) => {
      chatStore.toggleThinkingCollapse(messageId);
    },

    toggleToolsCollapse: (messageId: string) => {
      chatStore.toggleToolsCollapse(messageId);
    },

    deleteMessage: (messageId: string) => {
      chatStore.deleteMessage(messageId);
    },

    clearMessages: () => {
      chatStore.clearMessages();
    },

    regenerateMessage: (messageId: string) => {
      chatStore.regenerateMessage(messageId);
    },

    // 思考显示
    setShowThinking: (show: boolean) => {
      chatStore.setShowThinking(show);
    },

    // 工具操作（Placeholder实现）
    expandToolOutput: (_toolId: string) => {
      // 工具输出Expand在Group件状态中处理
    },

    collapseToolOutput: (_toolId: string) => {
      // 工具输出Collapse在Group件状态中处理
    },

    // 会话管理 - 使用 sessionManager 统一处理（包含 loading 和界面重建）
    createNewSession: async () => {
      // 调用 sessionManager 的方法，它会处理 loading、等待服务器返回和重建界面
      await sessionManager.createNewSession();
    },

    loadSession: async (sessionPath: string) => {
      const data = await createPromiseWithTimeout<any>({
        timeoutMessage: "加载会话超时",
        eventName: "session_loaded",
        onSuccess: async (data) => {
          if (data.success) {
            // 统一使用 shortId（8-character short ID）
            chatStore.setSessionId(data.shortId);
            // Use messages from WebSocket response (already merged with buffer)
            const messages = data.messages || [];
            console.log("[ChatAPI] session_loaded with messages:", messages.length);
            chatStore.setMessages(messages);
          } else {
            throw new Error(data.error || "Failed to load session");
          }
        },
        sendAction: () => switchChatSession(sessionPath),
      });
      return data;
    },

    // 模型管理
    setModel: async (fullModelId: string, thinkingLevel?: string) => {
      // Split fullModelId (format: "provider/modelId") into provider and modelId
      const lastSlashIndex = fullModelId.lastIndexOf("/");
      const provider = lastSlashIndex > 0 ? fullModelId.substring(0, lastSlashIndex) : "";
      const modelId = lastSlashIndex > 0 ? fullModelId.substring(lastSlashIndex + 1) : fullModelId;

      console.log("[ChatAPI] setModel:", { fullModelId, provider, modelId, thinkingLevel });

      await createPromiseWithTimeout<void>({
        timeoutMessage: "Set model超时",
        eventName: "model_set",
        onSuccess: (data) => {
          console.log("[ChatAPI] model_set success:", data);
          sessionStore.setCurrentModel(fullModelId);
        },
        sendAction: () => setChatModel(provider, modelId, thinkingLevel),
      });
    },

    setThinkingLevel: async (level: string) => {
      console.log("[ChatAPI] setThinkingLevel:", { level });

      await createPromiseWithTimeout<void>({
        timeoutMessage: "设置Thinking level超时",
        eventName: "thinking_set",
        onSuccess: (data) => {
          console.log("[ChatAPI] thinking_set success:", data);
          sessionStore.setThinkingLevel(level as any);
        },
        sendAction: () => setChatThinkingLevel(level),
      });
    },

    listModels: async () => {
      return createPromiseWithTimeout({
        timeoutMessage: "Cols出模型超时",
        eventName: "models_list",
        onSuccess: () => {},
        sendAction: listChatModels,
      });
    },

    // 系统Command
    executeCommand: async (command: string) => {
      return createPromiseWithTimeout({
        timeoutMessage: "执RowsCommand超时",
        eventName: "command_result",
        onSuccess: () => {},
        sendAction: () => executeChatCommand(command),
      });
    },

    // Compact session
    compactSession: async (customInstructions?: string) => {
      return createPromiseWithTimeout({
        timeoutMessage: "Compact session 超时",
        eventName: "compact_result",
        onSuccess: () => {},
        sendAction: () => compactSession(customInstructions),
        timeoutMs: 30000, // 30 seconds for compaction
      });
    },

    // Export session
    exportSession: async (outputPath?: string) => {
      return createPromiseWithTimeout({
        timeoutMessage: "Export session 超时",
        eventName: "export_result",
        onSuccess: () => {},
        sendAction: () => exportSession(outputPath),
        timeoutMs: 30000, // 30 seconds for export
      });
    },

    // LLM logs
    setLlmLogEnabled: async (enabled: boolean) => {
      await createPromiseWithTimeout<void>({
        timeoutMessage: "设置LLM logs超时",
        eventName: "llm_log_set",
        onSuccess: () => {},
        sendAction: () => setChatLlmLogEnabled(enabled),
      });
    },

    // 工作directories
    changeWorkingDir: async (path: string) => {
      await createPromiseWithTimeout<void>({
        timeoutMessage: "更改工作directories超时",
        eventName: "dir_changed",
        onSuccess: (data) => {
          sessionStore.setWorkingDir(data.cwd);
          chatStore.setSessionId(data.sessionId);
        },
        sendAction: () => initChatWorkingDirectory(path),
      });
    },
  };
}

// ============================================================================
// Streaming Handlers Setup - 全局WebSocket监听器设置
// ============================================================================

let handlersSetup = false;

/**
 * 设置全局WebSocket流式处理器
 *
 * 【架构设计说明】
 * 这是全局事件处理器，在应用初始化时调用一次（见 useAppInitialization.ts）。
 *
 * 【为什么 Service 直接操作 Store？】
 * 1. WebSocket 事件是"被动接收"，不是用户操作，不经过 UI 层
 * 2. 全局订阅必须在Group件挂载前完成，避免初始消息丢失
 * 3. 放在 Hook 中会导致：Group件卸载时事件处理中断、多个Group件重复订阅
 * 4. 这是 WebSocket 类服务的特殊处理模式，非通用做法
 *
 * 【正常数据流 vs WebSocket 事件流】
 * 正常数据流: UI → Hook → Service → Store
 * WebSocket事件: Service → (全局处理器) → Store → UI
 *
 * 【约定】
 * 只有 setupWebSocketListeners 可以直接操作 Store。
 * 其他 Service 代码必须通过 Hook 或 Controller 间接操作 Store。
 *
 * @example
 * // App 初始化时调用一次
 * setupWebSocketListeners();
 */
export function setupWebSocketListeners(): void {
  // 防止重复设置
  if (handlersSetup) return;
  handlersSetup = true;

  const store = useChatStore.getState();

  // =========================================================================
  // Message Level Events - 核心：处理每个消息的完整生命周期
  // =========================================================================
  websocketService.on("message_start", (data: { message?: any }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    const message = data?.message;
    console.log(`[${ts}] [RECV] message_start: ${message?.role}, id=${message?.id || "new"}`);

    // 记录事件到重建器
    messageReconstructor.recordEvent("message_start");

    // 重置重建器状态
    messageReconstructor.reset();

    if (message?.role === "assistant") {
      store.createStreamingMessage(message.id);
      messageReconstructor.startMessage(message.id);
    }
  });

  websocketService.on("message_end", (data: { message?: any }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    const message = data?.message;
    console.log(`[${ts}] [RECV] message_end: ${message?.role}, id=${message?.id}`);

    // 记录事件到重建器
    messageReconstructor.recordEvent("message_end");

    // 检查并修复未结束的内容块
    const fix = messageReconstructor.autoFix();
    if (fix?.action === "end_pending_blocks") {
      console.log(`[${ts}] [RECONSTRUCT] Auto-ending ${fix.data.length} pending blocks`);
      for (const block of fix.data) {
        store.endContentBlock(block.type, block.index);
      }
    }

    if (message?.role === "assistant") {
      store.finishStreaming();
    }

    // 结束重建器状态
    messageReconstructor.endMessage();
  });

  // Usage event handler
  websocketService.on("usage", (data: any) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] usage:`, data);

    if (data?.usage) {
      const usage = data.usage;
      const costValue = typeof usage.cost === "number" ? usage.cost : (usage.cost?.total ?? 0);
      let message = `📊 Usage: ${usage.totalTokens?.toLocaleString() || 0} tokens`;
      if (usage.inputTokens || usage.outputTokens) {
        message += ` (input: ${usage.inputTokens?.toLocaleString() || 0}, output: ${usage.outputTokens?.toLocaleString() || 0})`;
      }
      if (costValue) {
        message += ` · $${costValue.toFixed(4)}`;
      }
      if (usage.model) {
        message += ` · ${usage.model}`;
      }

      store.addMessage({
        id: `usage-${Date.now()}`,
        role: "system",
        kind: "usage",
        kind1: "sysinfo",
        kind2: "event",
        kind3: "usage",
        content: [{ type: "text", text: message }],
        timestamp: new Date(),
        isStreaming: false,
      });
    }
  });

  // =========================================================================
  // Content Block Level Events - Text
  // =========================================================================
  websocketService.on("text_start", (data: { index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] text_start[${data?.index ?? "?"}]`);
    store.startContentBlock("text", data?.index);
  });

  websocketService.on("text_delta", (data: { text?: string; index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] text_delta[${data?.index ?? "?"}]`);

    // 容错：检查是否需要自动创建 message_start
    if (messageReconstructor.shouldCreateMessageStart()) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing message_start`);
      store.createStreamingMessage();
      messageReconstructor.startMessage();
    }

    // 容错：检查是否需要自动创建 text_start
    const index = data?.index ?? 0;
    if (messageReconstructor.shouldCreateContentBlockStart(index, "text")) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing text_start[${index}]`);
      store.startContentBlock("text", index);
      messageReconstructor.startContentBlock(index, "text");
    }

    if (data?.text) {
      store.appendStreamingContent(data.text);
    }
  });

  websocketService.on("text_end", (data: { index?: number; implicit?: boolean }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(
      `[${ts}] [RECV] text_end[${data?.index ?? "?"}]${data?.implicit ? " (implicit)" : ""}`
    );
    store.endContentBlock("text", data?.index);
  });

  // =========================================================================
  // Content Block Level Events - Thinking
  // =========================================================================
  websocketService.on("thinking_start", (data: { index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] thinking_start[${data?.index ?? "?"}]`);
    store.startContentBlock("thinking", data?.index);
  });

  websocketService.on("thinking_delta", (data: { thinking?: string; index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] thinking_delta[${data?.index ?? "?"}]`);

    // 容错：检查是否需要自动创建 message_start
    if (messageReconstructor.shouldCreateMessageStart()) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing message_start`);
      store.createStreamingMessage();
      messageReconstructor.startMessage();
    }

    // 容错：检查是否需要自动创建 thinking_start
    const thinkingIndex = data?.index ?? 0;
    if (messageReconstructor.shouldCreateContentBlockStart(thinkingIndex, "thinking")) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing thinking_start[${thinkingIndex}]`);
      store.startContentBlock("thinking", thinkingIndex);
      messageReconstructor.startContentBlock(thinkingIndex, "thinking");
    }

    if (data?.thinking) {
      store.appendStreamingThinking(data.thinking);
    }
  });

  websocketService.on("thinking_end", (data: { index?: number; implicit?: boolean }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(
      `[${ts}] [RECV] thinking_end[${data?.index ?? "?"}]${data?.implicit ? " (implicit)" : ""}`
    );
    store.endContentBlock("thinking", data?.index);
  });

  // =========================================================================
  // Content Block Level Events - Tool Call (LLM generating tool call)
  // =========================================================================
  websocketService.on(
    "toolcall_start",
    (data: { toolCallId?: string; toolName?: string; index?: number }) => {
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(
        `[${ts}] [RECV] toolcall_start[${data?.index ?? "?"}]: ${data?.toolName || "unknown"}`
      );
      store.startContentBlock("tool_use", data?.index, {
        toolCallId: data?.toolCallId,
        toolName: data?.toolName,
      });
    }
  );

  websocketService.on(
    "toolcall_delta",
    (data: { toolCallId?: string; toolName?: string; delta?: string; index?: number }) => {
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(
        `[${ts}] [RECV] toolcall_delta[${data?.index ?? "?"}]: ${data?.toolName || "unknown"}`
      );

      // 容错：检查是否需要自动创建 message_start
      if (messageReconstructor.shouldCreateMessageStart()) {
        console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing message_start`);
        store.createStreamingMessage();
        messageReconstructor.startMessage();
      }

      // 容错：检查是否需要自动创建 toolcall_start
      const toolIndex = data?.index ?? 0;
      if (messageReconstructor.shouldCreateContentBlockStart(toolIndex, "tool_use")) {
        console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing toolcall_start[${toolIndex}]`);
        store.startContentBlock("tool_use", toolIndex, {
          toolCallId: data?.toolCallId,
          toolName: data?.toolName,
        });
        messageReconstructor.startContentBlock(toolIndex, "tool_use", {
          toolCallId: data?.toolCallId,
          toolName: data?.toolName,
        });
      }

      if (data?.toolCallId && data?.toolName) {
        store.appendToolCallDelta(data.toolCallId, data.toolName, data.delta || "");
      }
    }
  );

  websocketService.on(
    "toolcall_end",
    (data: { toolCallId?: string; toolName?: string; index?: number; implicit?: boolean }) => {
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(
        `[${ts}] [RECV] toolcall_end[${data?.index ?? "?"}]: ${data?.toolName || "unknown"}${data?.implicit ? " (implicit)" : ""}`
      );
      store.endContentBlock("tool_use", data?.index, {
        toolCallId: data?.toolCallId,
        toolName: data?.toolName,
      });
    }
  );

  // =========================================================================
  // Tool Execution Level Events (Actual tool running)
  // =========================================================================
  websocketService.on(
    "tool_execution_start",
    (data: { toolCallId?: string; toolName: string; args?: any }) => {
      try {
        const ts = new Date().toISOString().split("T")[1].split(".")[0];
        console.log(`[${ts}] [RECV] tool_execution_start: ${data?.toolName || "unknown"}`);

        const toolCallId = data?.toolCallId || generateToolId();

        // 【保存工具信息】用于孤立结果时显示
        executingTools.set(toolCallId, {
          name: data?.toolName || "unknown",
          args: data?.args || {},
        });

        const tool: ToolExecution = {
          id: toolCallId,
          name: data?.toolName || "unknown",
          args: data?.args || {},
          status: "executing",
          startTime: new Date(),
        };
        store.setActiveTool(tool);
      } catch (err) {
        console.error("[tool_execution_start] Error:", err);
      }
    }
  );

  websocketService.on("tool_execution_update", (data: { toolCallId: string; chunk?: string }) => {
    try {
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(`[${ts}] [RECV] tool_execution_update: ${data?.toolCallId}`);
      if (data?.chunk) {
        store.updateToolOutput(data.toolCallId, data.chunk, undefined);
      }
    } catch (err) {
      console.error("[tool_execution_update] Error:", err);
    }
  });

  websocketService.on(
    "tool_execution_end",
    (data: { toolCallId: string; result?: string; isError?: boolean }) => {
      try {
        const ts = new Date().toISOString().split("T")[1].split(".")[0];
        console.log(`[${ts}] [RECV] tool_execution_end: ${data?.toolCallId}`);

        if (!data?.toolCallId) {
          console.error(`[${ts}] [tool_execution_end] Missing toolCallId`);
          return;
        }

        const error = data?.isError ? "Tool execution failed" : undefined;

        // 尝试更新关联的工具
        store.updateToolOutput(data.toolCallId, data?.result || "", error);

        const state = store.getState();
        const activeTool = state.activeTools?.get(data.toolCallId);
        const hasStreamingTool = state.streamingToolCalls?.has(data.toolCallId) ?? false;
        const hasCurrentMessage =
          state.currentStreamingMessage?.content?.some(
            (c: any) => c.type === "tool_use" && c.toolCallId === data.toolCallId
          ) ?? false;

        console.log(
          `[${ts}] [tool_execution_end] Check orphan: active=${!!activeTool}, streaming=${hasStreamingTool}, current=${hasCurrentMessage}`
        );

        // Streaming message 已结束（finishStreaming 已调用）→ 需要更新已固化的 messages
        // Streaming message 仍在 → updateToolOutput 已更新 activeTools，useStreamingMessage 会显示结果
        if (!hasCurrentMessage) {
          const messages = state.messages;
          let messageUpdated = false;

          // 从后向前查找包含该 toolCallId 的消息
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const toolIndex = msg.content?.findIndex(
              (c: any) =>
                (c.type === "tool_use" || c.type === "tool") &&
                (c.toolCallId === data.toolCallId || c.id === data.toolCallId)
            );

            if (toolIndex !== undefined && toolIndex >= 0) {
              // 更新该消息中的工具块，将 tool_use 转换为 tool 并填充结果
              const updatedContent = [...msg.content];
              updatedContent[toolIndex] = {
                ...updatedContent[toolIndex],
                type: "tool",
                output: data?.result || "",
                error,
                status: error ? "error" : "success",
              };

              const updatedMessages = [...messages];
              updatedMessages[i] = { ...msg, content: updatedContent };
              store.setMessages(updatedMessages);
              messageUpdated = true;

              console.log(
                `[${ts}] [tool_execution_end] Updated existing message ${msg.id} with tool result for ${data.toolCallId}`
              );
              break;
            }
          }

          if (!messageUpdated) {
            // 未找到关联消息，创建独立工具结果消息
            console.log(
              `[${ts}] [TOOL_ORPHAN] Creating standalone message for ${data.toolCallId}`
            );

            // 获取保存的工具信息
            const toolInfo = executingTools.get(data.toolCallId);

            // Determine kind3 based on tool execution result
            const resultKind3 = error ? "tool_error" : "tool_success";

            store.addMessage({
              id: `tool-result-${Date.now()}`,
              role: "assistant",
              kind: resultKind3,
              kind1: "assistant",
              kind2: "tool",
              kind3: resultKind3,
              content: [
                {
                  type: "tool",
                  toolCallId: data.toolCallId,
                  toolName: toolInfo?.name || "unknown",
                  args: toolInfo?.args || {},
                  output: data?.result || "",
                  error,
                  status: error ? "error" : "success",
                },
              ],
              timestamp: new Date(),
              isStreaming: false,
            });
          }
        }

        // 清理存储的工具信息
        executingTools.delete(data.toolCallId);
      } catch (err) {
        console.error("[tool_execution_end] Error:", err);
      }
    }
  );

  // =========================================================================
  // System Events - 仅显示，不处理业务逻辑
  // =========================================================================
  websocketService.on("compaction_start", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] compaction_start`);
    store.addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "system",
      kind: "compaction",
      kind1: "sysinfo",
      kind2: "event",
      kind3: "compaction",
      content: [{ type: "text", text: "🗜️ Compacting context..." }],
      timestamp: new Date(),
    });
  });

  websocketService.on("compaction_end", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] compaction_end`);
    // 添加System message到消息Cols表
    store.addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "system",
      kind: "compaction",
      kind1: "sysinfo",
      kind2: "event",
      kind3: "compaction",
      content: [{ type: "text", text: "✅ Context compaction complete" }],
      timestamp: new Date(),
    });
  });

  // Retry start/end handlers
  websocketService.on("retry_start", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] retry_start`);
    // 添加System message到消息Cols表
    store.addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "system",
      kind: "retry",
      kind1: "sysinfo",
      kind2: "event",
      kind3: "retry",
      content: [{ type: "text", text: "🔄 Retrying..." }],
      timestamp: new Date(),
    });
  });

  websocketService.on("retry_end", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] retry_end`);
    // 添加System message到消息Cols表
    store.addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "system",
      kind: "retry",
      kind1: "sysinfo",
      kind2: "event",
      kind3: "retry",
      content: [{ type: "text", text: "✅ Retry complete" }],
      timestamp: new Date(),
    });
  });

  // Queue update handler
  websocketService.on("queue_update", (data: any) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] queue_update:`, data);
    // 可以在这里更新 UI 显示队Cols状态
  });

  // Auto retry handlers
  websocketService.on("auto_retry_start", (data: any) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] auto_retry_start:`, data);
    store.addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "system",
      kind: "auto_retry",
      kind1: "sysinfo",
      kind2: "event",
      kind3: "auto_retry",
      content: [
        { type: "text", text: `🔄 Auto-retrying (${data.attempt}/${data.maxAttempts})...` },
      ],
      timestamp: new Date(),
    });
  });

  websocketService.on("auto_retry_end", (data: any) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] auto_retry_end:`, data);
    if (data.success) {
      store.addMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: "system",
        kind: "auto_retry",
        kind1: "sysinfo",
        kind2: "event",
        kind3: "auto_retry",
        content: [{ type: "text", text: "✅ Auto-retry successful" }],
        timestamp: new Date(),
      });
    } else {
      store.addMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: "system",
        kind: "auto_retry",
        kind1: "sysinfo",
        kind2: "event",
        kind3: "auto_retry",
        content: [
          { type: "text", text: `❌ Auto-retry failed: ${data.finalError || "Unknown error"}` },
        ],
        timestamp: new Date(),
      });
    }
  });

  // Connection status handlers
  websocketService.on("connected", () => {
    console.log("[setupWebSocketListeners] WebSocket connected");
  });

  websocketService.on("session_reconnected", (data: any) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] session_reconnected:`, data);

    // 重置消息重建器状态，准备接收缓冲消息
    messageReconstructor.reset();

    // 如果 flushedMessages > 0，说明有缓冲消息即将到达
    if (data?.flushedMessages > 0) {
      console.log(`[${ts}] [RECONNECT] Expecting ${data.flushedMessages} buffered messages`);
    }
  });

  websocketService.on("disconnected", () => {
    console.log("[setupWebSocketListeners] WebSocket disconnected");
    // 如果正在流式生成，中止
    if (store.isStreaming) {
      store.abortStreaming();
    }
  });

  // Turn start/end handlers - 控制isRunning状态
  websocketService.on("turn_start", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] turn_start`);
    store.setIsRunning(true);
  });

  websocketService.on("turn_end", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] turn_end`);
    // Turn 结束，AI 完成输出，进入 waiting 状态（waiting for user input）
    store.setIsRunning(false);
  });

  // Initialized handler - 保存 resourceFiles、模型信息和会话 ID
  websocketService.on("initialized", (data: any) => {
    console.log("[setupWebSocketListeners] initialized");
    const sessionStore = useSessionStore.getState();
    const sidebarStore = useSidebarStore.getState();
    const chatStore = useChatStore.getState();

    if (data?.resourceFiles) {
      sessionStore.setResourceFiles(data.resourceFiles);
    }

    // 使用后端返回的 currentModel（已考虑 session 优先级）
    if (data?.currentModel) {
      sessionStore.setCurrentModel(data.currentModel);
      console.log("[initialized] Current model:", data.currentModel);
    }

    // 保存Default model信息（用于显示）
    if (data?.defaultModel) {
      sessionStore.setDefaultModel(data.defaultModel);
    }

    // 保存可用模型列表
    if (data?.allModels) {
      sessionStore.setAvailableModels(data.allModels);
      console.log("[initialized] Available models:", data.allModels.length);
    }

    // 设置当前选中的会话 ID（短 ID）
    const shortId = data?.currentSession?.shortId || data?.sessionId;
    if (shortId) {
      sidebarStore.setSelectedSessionId(shortId);
      console.log("[initialized] Session ID:", shortId);
    }

    // 处理消息
    const messages = data?.currentSession?.messages || [];
    if (messages.length > 0) {
      chatStore.setMessages(messages);
    }

    // 【统一处理】使用辅助函数更新 sessions 列表和状态
    updateSessionsAndStatus(sidebarStore, data?.allSessions || []);
    console.log("[initialized] Updated sessions and status");
  });

  // Dir changed handler - 同样处理模型信息
  websocketService.on("dir_changed", (data: any) => {
    console.log("[setupWebSocketListeners] dir_changed:", data);
    const sessionStore = useSessionStore.getState();
    const sidebarStore = useSidebarStore.getState();

    if (data?.resourceFiles) {
      sessionStore.setResourceFiles(data.resourceFiles);
    }

    if (data?.currentModel) {
      sessionStore.setCurrentModel(data.currentModel);
    }

    if (data?.defaultModel) {
      sessionStore.setDefaultModel(data.defaultModel);
    }

    // 保存可用模型列表
    if (data?.allModels) {
      sessionStore.setAvailableModels(data.allModels);
    }

    // 【统一处理】使用辅助函数更新 sessions 列表和状态
    updateSessionsAndStatus(sidebarStore, data?.allSessions || []);
    console.log("[dir_changed] Updated sessions and status");
  });

  // Sessions list handler - 更新Sidebar会话Cols表
  websocketService.on("sessions_list", (data: any) => {
    console.log("[setupWebSocketListeners] sessions_list:", data);
    const sidebarStore = useSidebarStore.getState();
    // 【统一处理】使用辅助函数更新 sessions 列表和状态
    updateSessionsAndStatus(sidebarStore, data?.sessions || []);
    console.log("[sessions_list] Updated sessions and status");
  });

  // Runtime status broadcast handler - 更新会话运Rows状态
  websocketService.on("runtime_status_broadcast", (data: any) => {
    try {
      console.log("[setupWebSocketListeners] runtime_status_broadcast:", data);
      if (!data || typeof data !== "object") {
        console.warn("[runtime_status_broadcast] Invalid data received:", data);
        return;
      }

      const sidebarStore = useSidebarStore.getState();
      if (!sidebarStore) {
        console.warn("[runtime_status_broadcast] Sidebar store not available");
        return;
      }

      if (Array.isArray(data.sessions)) {
        const statusList = data.sessions
          .filter((s: any) => s && typeof s === "object" && s.shortId)
          .map((s: any) => ({
            sessionId: s.shortId,
            status: s.status || "idle",
          }));

        if (statusList.length > 0) {
          sidebarStore.updateRuntimeStatusBulk(statusList);
          console.log(
            "[runtime_status_broadcast] Updated status for",
            statusList.length,
            "sessions"
          );
        }
      } else {
        console.warn("[runtime_status_broadcast] sessions is not an array:", data.sessions);
      }
    } catch (error) {
      console.error("[runtime_status_broadcast] Error in handler:", error);
    }
  });

  // Session status handler - 单个会话状态更新
  websocketService.on("session_status", (data: any) => {
    console.log("[setupWebSocketListeners] session_status:", data);
    const sidebarStore = useSidebarStore.getState();
    if (data?.sessionId && data?.status) {
      sidebarStore.setRuntimeStatus(data.sessionId, data.status);
    }
  });

  // More messages loaded handler - Load more历史消息
  websocketService.on("more_messages_loaded", async (data: any) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] more_messages_loaded:`, data);

    if (data?.messages && Array.isArray(data.messages)) {
      // 服务器已预处理所有消息，直接使用
      store.prependMessages(data.messages);
      console.log(
        `[${ts}] [more_messages_loaded] Prepended ${data.messages.length} messages, hasMore: ${data.hasMore}`
      );
    }
  });

  // Dir changed handler - 也保存 resourceFiles（切换directories时）
  websocketService.on("dir_changed", (data: any) => {
    console.log("[setupWebSocketListeners] dir_changed:", data);
    if (data?.resourceFiles) {
      useSessionStore.getState().setResourceFiles(data.resourceFiles);
    }
  });

  // Agent end handler - 已在 setupWebSocketListeners 中处理
  // Error handler - 由全局WebSocket服务统一处理
}

// ============================================================================
// Legacy API exports (for backward compatibility)
// ============================================================================

// wsClient 已废弃，请直接使用 websocketService
// createChatController 已废弃，请使用 useChatController hook
