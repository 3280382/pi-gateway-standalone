/**
 * Persist Config - App global persistence config
 *
 * Responsibilities:
 * - App-level persistence configuration
 * - Aggregate feature configs for debugging
 *
 * Naming convention:
 * - App: pi:app:{store}
 * - Each feature references its own config
 */

import { CHAT_STORAGE_KEYS } from "@/features/chat/stores/persist.config";
import { FILES_STORAGE_KEYS } from "@/features/files/stores/persist.config";

// ============================================================================
// App Storage Keys
// ============================================================================

export const APP_STORAGE_KEYS = {
  APP_GLOBAL: "pi:app:global",
  APP_WORKSPACE: "pi:app:workspace", // Global working directory (shared)
} as const;

// ============================================================================
// App Storage Versions
// ============================================================================

export const APP_STORAGE_VERSION = {
  APP_GLOBAL: 1,
  APP_WORKSPACE: 1,
} as const;

// ============================================================================
// App Persist Fields
// ============================================================================

export const APP_GLOBAL_PERSIST = ["currentView", "theme", "fontSize"] as const;

/** App Workspace Store - 持久化字段（全局工作directories） */
// 注意：currentBrowsePath 现在由 FileStore (pi:files:browser) 持久化
// workspaceStore only keeps workingDir
export const APP_WORKSPACE_PERSIST = ["workingDir"] as const;

// ============================================================================
// Aggregate all Storage Keys (for debugging)
// ============================================================================

export const ALL_STORAGE_KEYS = {
  ...APP_STORAGE_KEYS,
  ...CHAT_STORAGE_KEYS,
  ...FILES_STORAGE_KEYS,
} as const;

// ============================================================================
// Debug tools
// ============================================================================

/** Print all persisted states (dev use) */
export function inspectPersistedState(): void {
  if (process.env.NODE_ENV !== "development") return;

  console.group("🔍 Persisted State in localStorage");

  Object.values(ALL_STORAGE_KEYS).forEach((key) => {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        console.log(`\n${key}:`, {
          version: parsed.version,
          state: parsed.state,
        });
      } catch {
        console.log(`${key}: [Invalid JSON]`);
      }
    } else {
      console.log(`${key}: [Empty]`);
    }
  });

  console.groupEnd();
}

/** Clear all persisted states */
export function clearPersistedState(): void {
  Object.values(ALL_STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
  console.log("[Persist] All states cleared");
}

/** Expose to window for debugging (dev) */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).__PI_PERSIST = {
    inspect: inspectPersistedState,
    clear: clearPersistedState,
    keys: ALL_STORAGE_KEYS,
  };
}
