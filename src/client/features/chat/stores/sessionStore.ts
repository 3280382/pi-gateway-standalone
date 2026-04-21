/**
 * Session Store - Chat Feature 会话状态管理
 * 管理聊天会话、模型设置、连接状态
 *
 * 注意：所有 workspace 相关持久化字段已统一到 workspaceStore (pi:app:workspace)
 * - sessionFiles -> workspaceStore.sessionFiles
 * - defaultMessageLimit -> workspaceStore.defaultMessageLimit
 * - workingDir -> workspaceStore.currentPath (运行时同步副本保留)
 *
 * 刷新恢复流程：
 * 1. 从 workspaceStore 读取 currentPath
 * 2. 从 workspaceStore.sessionFiles 读取该 workspace 的 sessionFile
 * 3. 发送 init(currentPath, sessionFile) 恢复界面
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
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
  // 当前工作目录（运行时副本，从全局 workspaceStore 同步）
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
}

interface ChatSessionActions {
  // 工作目录（运行时，从 workspaceStore 同步）
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
}

export const useSessionStore = create<ChatSessionState & ChatSessionActions>()(
  devtools(
    (set) => ({
      // ===== Initial state =====
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
    }),
    { name: "ChatSessionStore" }
  )
);
