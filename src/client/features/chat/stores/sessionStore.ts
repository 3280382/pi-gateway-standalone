/**
 * Session Store - Chat Feature 会话状态管理
 * 管理聊天会话、模型设置、连接状态
 *
 * 持久化策略（v3）：
 * - currentWorkspace: 当前工作目录
 * - workspaceSessionFiles: 每个 workspace 对应的 sessionFile
 * - defaultMessageLimit: 用户设置
 *
 * 刷新恢复流程：
 * 1. 从 localStorage 读取 currentWorkspace
 * 2. 从 workspaceSessionFiles 读取该 workspace 的 sessionFile
 * 3. 发送 init(currentWorkspace, sessionFile) 恢复界面
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { CHAT_SESSION_PERSIST, CHAT_STORAGE_KEYS, CHAT_STORAGE_VERSION } from "./persist.config";

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

export interface ChatSessionState {
  // ===== 持久化字段 =====
  // 当前工作目录（刷新后恢复）
  currentWorkspace: string;
  // workspacePath -> sessionFile 映射（每个 workspace 独立）
  workspaceSessionFiles: Record<string, string>;

  // ===== 运行时字段（不持久化）=====
  // 当前工作目录（运行时副本，与 currentWorkspace 同步）
  workingDir: string;
  // 当前会话
  currentSessionId: string | null;
  currentSessionFile: string | null;
  // 模型设置（从服务器获取）
  currentModel: string | null;
  defaultModel: string | null;
  thinkingLevel: ThinkingLevel;
  availableModels: ModelInfo[];
  // 服务器状态
  serverPid: number | null;
  isConnected: boolean;
  // 资源文件路径
  resourceFiles: ResourceFiles | null;
  // 消息加载设置
  defaultMessageLimit: number;
}

interface ChatSessionActions {
  // Workspace 管理（持久化）
  setCurrentWorkspace: (workspace: string) => void;
  setWorkspaceSessionFile: (workspace: string, sessionFile: string) => void;
  getSessionFileForWorkspace: (workspace: string) => string | undefined;

  // 工作目录（运行时）
  setWorkingDir: (dir: string) => void;

  // 当前会话
  setCurrentSession: (id: string | null) => void;
  setCurrentSessionFile: (path: string | null) => void;

  // 模型设置
  setCurrentModel: (model: string | null) => void;
  setDefaultModel: (model: string | null) => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
  setAvailableModels: (models: ModelInfo[]) => void;

  // 服务器状态
  setServerPid: (pid: number | null) => void;
  setIsConnected: (connected: boolean) => void;

  // 资源文件
  setResourceFiles: (files: ResourceFiles | null) => void;

  // 消息加载设置
  setDefaultMessageLimit: (limit: number) => void;
}

export const useSessionStore = create<ChatSessionState & ChatSessionActions>()(
  persist(
    devtools(
      (set, get) => ({
        // ===== Initial state =====
        currentWorkspace: "/root",
        workspaceSessionFiles: {},

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
        defaultMessageLimit: 100,

        // ===== Workspace 管理（持久化）=====
        setCurrentWorkspace: (workspace) =>
          set({ currentWorkspace: workspace, workingDir: workspace }),

        setWorkspaceSessionFile: (workspace, sessionFile) =>
          set((state) => ({
            workspaceSessionFiles: {
              ...state.workspaceSessionFiles,
              [workspace]: sessionFile,
            },
          })),

        getSessionFileForWorkspace: (workspace) => {
          return get().workspaceSessionFiles[workspace];
        },

        // ===== 运行时操作 =====
        setWorkingDir: (dir) => set({ workingDir: dir }),

        setCurrentSession: (id) => set({ currentSessionId: id }),
        setCurrentSessionFile: (path) => set({ currentSessionFile: path }),

        setCurrentModel: (model) => set({ currentModel: model }),
        setDefaultModel: (model) => set({ defaultModel: model }),
        setThinkingLevel: (level) => set({ thinkingLevel: level }),
        setAvailableModels: (models) => set({ availableModels: models }),

        setServerPid: (pid) => set({ serverPid: pid }),
        setIsConnected: (connected) => set({ isConnected: connected }),

        setResourceFiles: (files) => set({ resourceFiles: files }),

        setDefaultMessageLimit: (limit) => set({ defaultMessageLimit: limit }),
      }),
      { name: "ChatSessionStore" }
    ),
    {
      name: CHAT_STORAGE_KEYS.CHAT_SESSION,
      version: CHAT_STORAGE_VERSION.CHAT_SESSION,
      migrate: (persistedState: any, version: number) => {
        const state = persistedState;

        // v2 -> v3: 从单一 currentSessionFile 迁移到 per-workspace 映射
        if (version < 3) {
          // 如果有旧的 currentSessionFile，迁移到当前 workingDir 下
          const oldSessionFile = state.currentSessionFile;
          const oldWorkingDir = state.workingDir || state.currentWorkspace || "/root";

          state.currentWorkspace = oldWorkingDir;
          state.workspaceSessionFiles = {};

          if (oldSessionFile) {
            state.workspaceSessionFiles[oldWorkingDir] = oldSessionFile;
          }

          // 清理旧字段
          delete state.currentSessionFile;
          delete state.workingDir; // workingDir 不持久化
        }

        // v1 -> v2/v3: 清除模型字段
        if (version < 2) {
          delete state.currentModel;
          delete state.defaultModel;
        }

        return state;
      },
      partialize: (state) =>
        Object.fromEntries(
          CHAT_SESSION_PERSIST.map((key) => [key, (state as any)[key]])
        ) as Partial<ChatSessionState & ChatSessionActions>,
    }
  )
);
