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
  reloadSession,
  sendChatMessage,
  setChatModel,
  setChatThinkingLevel,
  steerChat,
} from "@/features/chat/services/chatWebSocket";

import { sessionManager, updateSessionsAndStatus } from "@/features/chat/services/sessionManager";
import { generateMessageId, useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { ChatController, Message, ToolExecution } from "@/features/chat/types/chat";
import { createUserMessage } from "@/features/chat/utils/messageUtils";
import { websocketService } from "@/services/websocket.service";

// ============================================================================
// Tool ID Generator (Message ID is in chatStore)
// ============================================================================

function generateToolId(): string {
  return `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper to create a system info message with consistent structure
 */
function createSystemInfoMessage(
  text: string,
  kind: Message["kind"] = undefined,
  kind3: Message["kind3"] = undefined
): Message {
  return {
    id: generateMessageId(),
    role: "system",
    kind,
    kind1: "sysinfo",
    kind2: "event",
    kind3,
    content: [{ type: "text", text }],
    timestamp: new Date(),
  };
}

/**
 * Update session store from server data (shared between init and dir_change)
 */
function updateSessionStoreFromServerData(data: any): void {
  const sessionStore = useSessionStore.getState();

  if (data?.resourceFiles) {
    sessionStore.setResourceFiles(data.resourceFiles);
  }
  if (data?.currentModel) {
    sessionStore.setCurrentModel(data.currentModel);
  }
  if (data?.defaultModel) {
    sessionStore.setDefaultModel(data.defaultModel);
  }
  if (data?.allModels) {
    sessionStore.setAvailableModels(data.allModels);
  }
}

// ============================================================================
// Enhanced Chat Controller Interface (扩展原有接口)
// ============================================================================

export interface EnhancedChatController extends ChatController {
  // 扩展功能
  steer: (text: string) => void;
  createNewSession: () => Promise<void>;

  setModel: (modelId: string, thinkingLevel?: string) => Promise<void>;
  setThinkingLevel: (level: string) => Promise<void>;
  executeCommand: (command: string) => Promise<any>;
  compactSession: (customInstructions?: string) => Promise<any>;
  exportSession: (outputPath?: string) => Promise<any>;
  reloadSession: () => Promise<any>;
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

    const unsubscribe = websocketService.on(eventName as any, (data: T) => {
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
        kind1: "user",
        kind2: "prompt",
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

      chatStore.addMessage(createUserMessage(text.trim()));
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
      (chatStore as any).toggleToolsCollapse(messageId);
    },

    clearMessages: () => {
      chatStore.clearMessages();
    },

    // 思考显示
    setShowThinking: (show: boolean) => {
      chatStore.setShowThinking(show);
    },

    // 会话管理 - 使用 sessionManager 统一处理（包含 loading 和界面重建）
    createNewSession: async () => {
      // 调用 sessionManager 的方法，它会处理 loading、等待服务器返回和重建界面
      await sessionManager.createNewSession();
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

    // Reload session resources (skills, extensions, prompts, etc.)
    reloadSession: async () => {
      return createPromiseWithTimeout({
        timeoutMessage: "Reload session 超时",
        eventName: "reload_result",
        onSuccess: () => {},
        sendAction: () => reloadSession(),
        timeoutMs: 15000,
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

    if (message?.role === "assistant") {
      store.createStreamingMessage(message.id);
    }
  });

  websocketService.on("message_end", (data: { message?: any }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    const message = data?.message;
    console.log(`[${ts}] [RECV] message_end: ${message?.role}, id=${message?.id}`);

    if (message?.role === "assistant") {
      store.finishStreaming();
    }
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

        const state = (store as any).getState?.() ?? store;
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
            console.log(`[${ts}] [TOOL_ORPHAN] Creating standalone message for ${data.toolCallId}`);

            // 获取保存的工具信息
            const toolInfo = executingTools.get(data.toolCallId);

            // Determine kind3 based on tool execution result
            const resultKind3: any = error ? "tool_error" : "tool_success";

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
    store.addMessage(
      createSystemInfoMessage("🗜️ Compacting context...", "compaction", "compaction")
    );
  });

  websocketService.on("compaction_end", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] compaction_end`);
    // 添加System message到消息Cols表
    store.addMessage(
      createSystemInfoMessage("✅ Context compaction complete", "compaction", "compaction")
    );
  });

  // Retry start/end handlers
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
      ...createSystemInfoMessage("", "auto_retry", "auto_retry"),
      content: [
        { type: "text", text: `🔄 Auto-retrying (${data.attempt}/${data.maxAttempts})...` },
      ],
    });
  });

  websocketService.on("auto_retry_end", (data: any) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] auto_retry_end:`, data);
    if (data.success) {
      store.addMessage(
        createSystemInfoMessage("✅ Auto-retry successful", "auto_retry", "auto_retry")
      );
    } else {
      store.addMessage({
        ...createSystemInfoMessage("", "auto_retry", "auto_retry"),
        content: [
          { type: "text", text: `❌ Auto-retry failed: ${data.finalError || "Unknown error"}` },
        ],
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

  // Dir changed handler
  websocketService.on("dir_changed", (data: any) => {
    console.log("[setupWebSocketListeners] dir_changed:", data);
    updateSessionStoreFromServerData(data);
    updateSessionsAndStatus(useSidebarStore.getState(), data?.allSessions || []);
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

  // =========================================================================
  // Heartbeat Events - WebSocket Ping/Pong
  // Client sends ping, server replies with pong
  // =========================================================================
  websocketService.on("pong", (data: any) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    const latency = data?.latency || 0;
    console.log(`[${ts}] [RECV] pong, latency: ${latency}ms`);

    // Update heartbeat status with latency, clear waiting state
    useSessionStore.setState({
      heartbeat: {
        lastPingTime: data?.timestamp || Date.now() - latency,
        lastPongTime: data?.receivedAt || Date.now(),
        latency,
        connectionQuality: latency < 100 ? "excellent" : latency < 500 ? "good" : "poor",
        isWaiting: false,
      },
    });
  });

  // Agent end handler - 已在 setupWebSocketListeners 中处理
  // Error handler - 由全局WebSocket服务统一处理
}

// ============================================================================
// Legacy API exports (for backward compatibility)
// ============================================================================

// wsClient 已废弃，请直接使用 websocketService
// createChatController 已废弃，请使用 useChatController hook
