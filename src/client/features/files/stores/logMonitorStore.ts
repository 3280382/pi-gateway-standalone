/**
 * LogMonitor Store - 文件日志监控配置管理
 *
 * Responsibilities:
 * - 管理日志监控配置列表（名称 + 文件路径数组）
 * - 持久化到 localStorage
 * - 管理监控面板开关状态
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export interface LogMonitorConfig {
  id: string;
  name: string;
  filePaths: string[];
  createdAt: string;
}

export interface LogMonitorState {
  configs: LogMonitorConfig[];
  activeMonitorId: string | null;
  isPanelOpen: boolean;
  panelHeight: number;
}

export interface LogMonitorActions {
  addConfig: (name: string, filePaths: string[]) => void;
  removeConfig: (id: string) => void;
  updateConfig: (
    id: string,
    updates: Partial<Pick<LogMonitorConfig, "name" | "filePaths">>
  ) => void;
  setActiveMonitor: (id: string | null) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  setPanelHeight: (height: number) => void;
  getConfigById: (id: string) => LogMonitorConfig | undefined;
}

// ============================================================================
// Storage
// ============================================================================

const STORAGE_KEY = "pi:files:log-monitors";

function loadConfigs(): LogMonitorConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

function saveConfigs(configs: LogMonitorConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch {
    // ignore
  }
}

// ============================================================================
// Store
// ============================================================================

export const useLogMonitorStore = create<LogMonitorState & LogMonitorActions>()(
  devtools(
    (set, get) => ({
      // Initial State
      configs: loadConfigs(),
      activeMonitorId: null,
      isPanelOpen: false,
      panelHeight: 400,

      // =======================================================================
      // Config Management
      // =======================================================================

      addConfig: (name: string, filePaths: string[]) => {
        const config: LogMonitorConfig = {
          id: `logmon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: name.trim(),
          filePaths: filePaths.filter((p) => p.trim()),
          createdAt: new Date().toISOString(),
        };
        const newConfigs = [...get().configs, config];
        set({ configs: newConfigs }, false, "addLogMonitorConfig");
        saveConfigs(newConfigs);
      },

      removeConfig: (id: string) => {
        const newConfigs = get().configs.filter((c) => c.id !== id);
        const updates: Partial<LogMonitorState> = { configs: newConfigs };
        if (get().activeMonitorId === id) {
          updates.activeMonitorId = null;
          updates.isPanelOpen = false;
        }
        set(updates, false, "removeLogMonitorConfig");
        saveConfigs(newConfigs);
      },

      updateConfig: (id: string, updates) => {
        const newConfigs = get().configs.map((c) =>
          c.id === id
            ? {
                ...c,
                ...updates,
                filePaths: updates.filePaths?.filter((p) => p.trim()) ?? c.filePaths,
              }
            : c
        );
        set({ configs: newConfigs }, false, "updateLogMonitorConfig");
        saveConfigs(newConfigs);
      },

      // =======================================================================
      // UI
      // =======================================================================

      setActiveMonitor: (id: string | null) => {
        set({ activeMonitorId: id, isPanelOpen: id !== null }, false, "setActiveLogMonitor");
      },

      setPanelOpen: (open: boolean) => {
        set({ isPanelOpen: open }, false, "setLogMonitorPanelOpen");
      },

      togglePanel: () => {
        set((state) => ({ isPanelOpen: !state.isPanelOpen }), false, "toggleLogMonitorPanel");
      },

      setPanelHeight: (height: number) => {
        set(
          { panelHeight: Math.max(120, Math.min(800, height)) },
          false,
          "setLogMonitorPanelHeight"
        );
      },

      // =======================================================================
      // Getters
      // =======================================================================

      getConfigById: (id: string) => {
        return get().configs.find((c) => c.id === id);
      },
    }),
    { name: "LogMonitorStore" }
  )
);
