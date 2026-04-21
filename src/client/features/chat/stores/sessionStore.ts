/**
 * Session Store - Chat Feature 会话状态管理
 * 管理聊天会话、模型设置、连接状态
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { CHAT_SESSION_PERSIST, CHAT_STORAGE_KEYS } from "./persist.config";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface Session {
  id: string;
  name: string;
  path: string;
  messageCount: number;
  lastModified: string;
}

export interface ResourceFiles {
  systemPrompt: {
    global: string;
    project: string;
    loaded: string;
  };
  appendSystemPrompt: Array<{
    path: string;
    exists: boolean;
  }>;
  agentsFiles: Array<{
    path: string;
    exists: boolean;
  }>;
  settings: {
    path: string;
    exists: boolean;
  };
  auth: {
    path: string;
    exists: boolean;
  };
  session: {
    path: string;
    exists: boolean;
  };
  models: {
    path: string;
    exists: boolean;
  };
  skills: {
    global: string;
    project: string;
    loaded: Array<{
      name: string;
      path: string;
    }>;
  };
  prompts: {
    global: string;
    project: string;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  maxTokens?: number;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ("text" | "image")[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  maxTokens?: number;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ("text" | "image")[];
}

export interface ChatSessionState {
  // 当前工作directories
  workingDir: string;

  // 当前会话
  currentSessionId: string | null;
  currentSessionFile: string | null; // session files路径，用于 init 时的Exact match

  // 模型设置（从服务器获取，不持久化到 localStorage）
  currentModel: string | null; // 当前实际使用的模型（优先 session 级别）
  defaultModel: string | null; // settings.json 中的Default model
  thinkingLevel: ThinkingLevel;
  availableModels: ModelInfo[];

  // 服务器状态
  serverPid: number | null;
  isConnected: boolean;

  // 资源files路径
  resourceFiles: ResourceFiles | null;

  // 消息加载设置
  defaultMessageLimit: number; // 默认加载历史消息Items数，-1表示加载所有
}

interface ChatSessionActions {
  // 工作directories
  setWorkingDir: (dir: string) => void;

  // 当前会话（用于 UI 显示当前选中的 session）
  setCurrentSession: (id: string | null) => void;
  setCurrentSessionFile: (path: string | null) => void; // 设置 session files路径

  // 模型设置
  setCurrentModel: (model: string | null) => void;
  setDefaultModel: (model: string | null) => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
  setAvailableModels: (models: ModelInfo[]) => void;

  // 服务器状态
  setServerPid: (pid: number | null) => void;
  setIsConnected: (connected: boolean) => void;

  // 资源files
  setResourceFiles: (files: ResourceFiles | null) => void;

  // 消息加载设置
  setDefaultMessageLimit: (limit: number) => void;
}

export const useSessionStore = create<ChatSessionState & ChatSessionActions>()(
  persist(
    devtools(
      (set) => ({
        // Initial state
        workingDir: "/root",
        currentSessionId: null,
        currentSessionFile: null,
        currentModel: null,
        defaultModel: null,
        thinkingLevel: "off",
        availableModels: [],
        serverPid: null,
        isConnected: false,
        resourceFiles: null,
        defaultMessageLimit: 100, // 默认加载100Items，-1表示加载所有

        // 工作directories
        // 注意：此方法仅更新本地状态，全局 workspaceStore 的同步由调用方负责
        // 或通过全局 workspaceStore.setWorkingDir 触发反向同步
        setWorkingDir: (dir) => set({ workingDir: dir }),

        // 当前会话
        setCurrentSession: (id) => set({ currentSessionId: id }),
        setCurrentSessionFile: (path) => set({ currentSessionFile: path }),

        // 模型设置
        setCurrentModel: (model) => set({ currentModel: model }),
        setDefaultModel: (model) => set({ defaultModel: model }),
        setThinkingLevel: (level) => set({ thinkingLevel: level }),
        setAvailableModels: (models) => set({ availableModels: models }),

        // 服务器状态
        setServerPid: (pid) => set({ serverPid: pid }),
        setIsConnected: (connected) => set({ isConnected: connected }),

        // 资源files
        setResourceFiles: (files) => set({ resourceFiles: files }),

        // 消息加载设置
        setDefaultMessageLimit: (limit) => set({ defaultMessageLimit: limit }),
      }),
      { name: "ChatSessionStore" }
    ),
    {
      name: CHAT_STORAGE_KEYS.CHAT_SESSION,
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => CHAT_SESSION_PERSIST.includes(key))
        ) as Partial<ChatSessionState & ChatSessionActions>,
    }
  )
);
