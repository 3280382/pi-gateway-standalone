/**
 * LLM Log Store - LLM logs设置与配置
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LlmLogConfig {
  enabled: boolean;
  refreshInterval: number; // seconds
  truncateLength: number; // lines
}

export interface LlmLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LlmLogState {
  // 配置
  config: LlmLogConfig;
  // Log entry
  logs: LlmLogEntry[];
  // 模态框状态
  isModalOpen: boolean;
}

interface LlmLogActions {
  // 配置操作
  setConfig: (config: Partial<LlmLogConfig>) => void;
  setEnabled: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  // 日志操作
  addLog: (entry: LlmLogEntry) => void;
  clearLogs: () => void;
  // 模态框操作
  openModal: () => void;
  closeModal: () => void;
}

export const useLlmLogStore = create<LlmLogState & LlmLogActions>()(
  persist(
    (set, _get) => ({
      // Initial state
      config: {
        enabled: true,
        refreshInterval: 5,
        truncateLength: 1000,
      },
      logs: [],
      isModalOpen: false,

      // 配置操作
      setConfig: (config) =>
        set((state) => ({
          config: { ...state.config, ...config },
        })),
      setEnabled: (enabled) =>
        set((state) => ({
          config: { ...state.config, enabled },
        })),
      setRefreshInterval: (refreshInterval) =>
        set((state) => ({
          config: { ...state.config, refreshInterval },
        })),

      // 日志操作
      addLog: (entry) =>
        set((state) => {
          const newLogs = [entry, ...state.logs].slice(0, state.config.truncateLength);
          return { logs: newLogs };
        }),
      clearLogs: () => set({ logs: [] }),

      // 模态框操作
      openModal: () => set({ isModalOpen: true }),
      closeModal: () => set({ isModalOpen: false }),
    }),
    {
      name: "llm-log-store",
      partialize: (state) => ({ config: state.config }),
    }
  )
);

// Selectors
export const selectLlmLogConfig = (state: LlmLogState) => state.config;
export const selectLlmLogs = (state: LlmLogState) => state.logs;
export const selectIsLlmLogModalOpen = (state: LlmLogState) => state.isModalOpen;
