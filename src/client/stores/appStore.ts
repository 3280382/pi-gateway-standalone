/**
 * App Store - Application-level state management
 * Unified management of view switching
 */

// ===== [ANCHOR:IMPORTS] =====

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { APP_GLOBAL_PERSIST, APP_STORAGE_KEYS, APP_STORAGE_VERSION } from "./persist.config";

// ===== [ANCHOR:TYPES] =====

export type ViewType = "chat" | "files";
export type BottomPanelType = "terminal" | "preview" | null;
export type Theme = "dark" | "light";
export type FontSize = "tiny" | "small" | "medium" | "large";

interface AppState {
  // View状态
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  // Global settings
  theme: Theme;
  setTheme: (theme: Theme) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

// ===== [ANCHOR:STATE] =====

export const useAppStore = create<AppState>()(
  persist(
    (set, _get) => ({
      // Initial state
      currentView: "chat",

      // View操作
      setCurrentView: (view) => set({ currentView: view }),

      // Global settings
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      fontSize: "medium",
      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      name: APP_STORAGE_KEYS.APP_GLOBAL,
      version: APP_STORAGE_VERSION.APP_GLOBAL,
      partialize: (state) => Object.fromEntries(APP_GLOBAL_PERSIST.map((key) => [key, state[key]])),
    }
  )
);
