/**
 * Enhanced Chat API - 完整整合所有WebSocket功能
 * 连接Zustand Store与后端WebSocket，实现所有后端支持的功能
 */

import {
  abortChatGeneration,
  createNewChatSession,
  executeChatCommand,
  initChatWorkingDirectory,
  listChatModels,
  listChatSessions,
  sendChatMessage,
  setChatLlmLogEnabled,
  setChatModel,
  setChatThinkingLevel,
  steerChat,
  switchChatSession,
} from "@/features/chat/services/chatWebSocket";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { ChatController, Message, ToolExecution } from "@/features/chat/types/chat";
import { websocketService } from "@/services/websocket.service";
import { sessionManager } from "@/features/chat/services/sessionManager";
import {
  messageReconstructor,
  isContentDeltaEvent,
  isContentStartEvent,
  getContentTypeFromDelta,
} from "@/features/chat/services/messageReconstruction";

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

      // 添加用户消息
      const userMessage: Message = {
        id: generateMessageId(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      chatStore.addMessage(userMessage);
      chatStore.clearInput();
      chatStore.startStreaming();

      // 通过WebSocket发送消息
      const success = sendChatMessage(text, undefined, undefined, images);

      if (!success) {
        chatStore.abortStreaming();
        throw new Error("消息发送失败，请重试");
      }
    },

    abortGeneration: () => {
      abortChatGeneration();
      chatStore.abortStreaming();
    },

    steer: (text: string) => {
      if (!text.trim()) return;
    
      // 添加用户消息到列表（类似 sendMessage）
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

    // 工具操作（占位符实现）
    expandToolOutput: (_toolId: string) => {
      // 工具输出展开在组件状态中处理
    },

    collapseToolOutput: (_toolId: string) => {
      // 工具输出折叠在组件状态中处理
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
            // 统一使用 shortId（8字符短 ID）
            chatStore.setSessionId(data.shortId);
            // Use messages from WebSocket response (already merged with buffer)
            const messages = data.messages || [];
            console.log("[ChatAPI] session_loaded with messages:", messages.length);
            chatStore.setMessages(messages);
          } else {
            throw new Error(data.error || "加载会话失败");
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
        timeoutMessage: "设置模型超时",
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
        timeoutMessage: "设置思考级别超时",
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
        timeoutMessage: "列出模型超时",
        eventName: "models_list",
        onSuccess: () => {},
        sendAction: listChatModels,
      });
    },

    // 系统命令
    executeCommand: async (command: string) => {
      return createPromiseWithTimeout({
        timeoutMessage: "执行命令超时",
        eventName: "command_result",
        onSuccess: () => {},
        sendAction: () => executeChatCommand(command),
      });
    },

    // LLM日志
    setLlmLogEnabled: async (enabled: boolean) => {
      await createPromiseWithTimeout<void>({
        timeoutMessage: "设置LLM日志超时",
        eventName: "llm_log_set",
        onSuccess: () => {},
        sendAction: () => setChatLlmLogEnabled(enabled),
      });
    },

    // 工作目录
    changeWorkingDir: async (path: string) => {
      await createPromiseWithTimeout<void>({
        timeoutMessage: "更改工作目录超时",
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
 * 2. 全局订阅必须在组件挂载前完成，避免初始消息丢失
 * 3. 放在 Hook 中会导致：组件卸载时事件处理中断、多个组件重复订阅
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
    };
    
    // 容错：检查是否需要自动创建 text_start
    const index = data?.index ?? 0;
    if (messageReconstructor.shouldCreateContentBlockStart(index, "text")) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing text_start[${index}]`);
      store.startContentBlock("text", index);
      messageReconstructor.startContentBlock(index, "text");
    };
    
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
    };
    
    // 容错：检查是否需要自动创建 thinking_start
    const thinkingIndex = data?.index ?? 0;
    if (messageReconstructor.shouldCreateContentBlockStart(thinkingIndex, "thinking")) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing thinking_start[${thinkingIndex}]`);
      store.startContentBlock("thinking", thinkingIndex);
      messageReconstructor.startContentBlock(thinkingIndex, "thinking");
    };
    
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
      };
      
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
      };
      
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
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(`[${ts}] [RECV] tool_execution_start: ${data?.toolName || "unknown"}`);

      const tool: ToolExecution = {
        id: data?.toolCallId || generateToolId(),
        name: data?.toolName || "unknown",
        args: data?.args || {},
        status: "executing",
        startTime: new Date(),
      };
      store.setActiveTool(tool);
    }
  );

  websocketService.on("tool_execution_update", (data: { toolCallId: string; chunk?: string }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] tool_execution_update: ${data?.toolCallId}`);
    if (data?.chunk) {
      store.updateToolOutput(data.toolCallId, data.chunk, undefined);
    }
  });

  websocketService.on(
    "tool_execution_end",
    (data: { toolCallId: string; result?: string; isError?: boolean }) => {
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(`[${ts}] [RECV] tool_execution_end: ${data?.toolCallId}`);
      const error = data?.isError ? "工具执行失败" : undefined;
      store.updateToolOutput(data.toolCallId, data?.result || "", error);
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
      content: [{ type: "text", text: "🗜️ 正在压缩上下文..." }],
      timestamp: new Date(),
    });
  });

  websocketService.on("compaction_end", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] compaction_end`);
    // 添加系统消息到消息列表
    store.addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "system",
      content: [{ type: "text", text: "✅ 上下文压缩完成" }],
      timestamp: new Date(),
    });
  });

  // Retry start/end handlers
  websocketService.on("retry_start", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] retry_start`);
    // 添加系统消息到消息列表
    store.addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "system",
      content: [{ type: "text", text: "🔄 正在重试..." }],
      timestamp: new Date(),
    });
  });

  websocketService.on("retry_end", () => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] retry_end`);
    // 添加系统消息到消息列表
    store.addMessage({
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "system",
      content: [{ type: "text", text: "✅ 重试完成" }],
      timestamp: new Date(),
    });
  });

  // Connection status handlers
  websocketService.on("connected", () => {
    console.log("[setupWebSocketListeners] WebSocket connected");
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
    store.setIsRunning(false);
  });

  // Initialized handler - 保存 resourceFiles、模型信息和会话 ID
  websocketService.on("initialized", (data: any) => {
    console.log("[setupWebSocketListeners] initialized:", data);
    const sessionStore = useSessionStore.getState();
    const sidebarStore = useSidebarStore.getState();
  
    if (data?.resourceFiles) {
      sessionStore.setResourceFiles(data.resourceFiles);
    }
  
    // 使用后端返回的 currentModel（已考虑 session 优先级）
    if (data?.currentModel) {
      sessionStore.setCurrentModel(data.currentModel);
      console.log("[initialized] Current model:", data.currentModel);
    }
  
    // 保存默认模型信息（用于显示）
    if (data?.defaultModel) {
      sessionStore.setDefaultModel(data.defaultModel);
    }
  
    // 设置当前选中的会话 ID（短 ID）
    const shortId = data?.currentSession?.shortId || data?.sessionId;
    if (shortId) {
      sidebarStore.setSelectedSessionId(shortId);
      console.log("[initialized] Session ID:", shortId);
    }
  });

  // Dir changed handler - 同样处理模型信息
  websocketService.on("dir_changed", (data: any) => {
    console.log("[setupWebSocketListeners] dir_changed:", data);
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
  });

  // Sessions list handler - 更新侧边栏会话列表
  websocketService.on("sessions_list", (data: any) => {
    console.log("[setupWebSocketListeners] sessions_list:", data);
    const sidebarStore = useSidebarStore.getState();
    if (data?.sessions) {
      sidebarStore.setSessions(data.sessions);
    
      // Also update runtimeStatus from the status field in sessions
      const statusList = data.sessions
        .filter((s: any) => s && s.id && s.status)
        .map((s: any) => ({
          sessionId: s.id,
          status: s.status,
        }));
    
      if (statusList.length > 0) {
        sidebarStore.updateRuntimeStatusBulk(statusList);
        console.log("[sessions_list] Updated runtime status for", statusList.length, "sessions");
      }
    }
  });

  // Runtime status broadcast handler - 更新会话运行状态
  websocketService.on("runtime_status_broadcast", (data: any) => {
    try {
      console.log("[setupWebSocketListeners] runtime_status_broadcast:", data);
      if (!data || typeof data !== 'object') {
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
          .filter((s: any) => s && typeof s === 'object' && s.shortId)
          .map((s: any) => ({
            sessionId: s.shortId,
            status: s.status || 'idle',
          }));
      
        if (statusList.length > 0) {
          sidebarStore.updateRuntimeStatusBulk(statusList);
          console.log("[runtime_status_broadcast] Updated status for", statusList.length, "sessions");
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

  // Dir changed handler - 也保存 resourceFiles（切换目录时）
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
