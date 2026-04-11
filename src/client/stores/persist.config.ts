/**
 * Persist Config - App 全局持久化配置
 *
 * 职责：
 * - App 级别的持久化配置
 * - 聚合各 feature 的配置供调试使用
 *
 * 命名规范：
 * - App: pi:app:{store}
 * - 各 feature 引用自己的配置文件
 */

import { CHAT_STORAGE_KEYS } from "@/features/chat/stores/persist.config";
import { FILES_STORAGE_KEYS } from "@/features/files/stores/persist.config";

// ============================================================================
// App Storage Keys
// ============================================================================

export const APP_STORAGE_KEYS = {
  APP_GLOBAL: "pi:app:global",
} as const;

// ============================================================================
// App Storage Versions
// ============================================================================

export const APP_STORAGE_VERSION = {
  APP_GLOBAL: 1,
} as const;

// ============================================================================
// App Persist Fields
// ============================================================================

export const APP_GLOBAL_PERSIST = ["currentView", "theme", "fontSize"] as const;

// ============================================================================
// 聚合所有 Storage Keys（供调试使用）
// ============================================================================

export const ALL_STORAGE_KEYS = {
  ...APP_STORAGE_KEYS,
  ...CHAT_STORAGE_KEYS,
  ...FILES_STORAGE_KEYS,
} as const;

// ============================================================================
// 调试工具
// ============================================================================

/** 打印所有持久化状态（开发环境使用） */
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

/** 清空所有持久化状态 */
export function clearPersistedState(): void {
  Object.values(ALL_STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
  console.log("[Persist] All states cleared");
}

/** 暴露到 window 供调试（开发环境） */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).__PI_PERSIST = {
    inspect: inspectPersistedState,
    clear: clearPersistedState,
    keys: ALL_STORAGE_KEYS,
  };
}
