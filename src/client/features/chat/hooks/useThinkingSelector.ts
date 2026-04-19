/**
 * useThinkingSelector - Thinking Level 选择器逻辑 Hook
 *
 * Responsibilities:
 * - 管理 thinking level 选择器状态
 * - 处理 thinking level 选择
 */

import { useCallback, useState } from "react";

// Thinking levels - must match backend enum: ["off", "minimal", "low", "medium", "high", "xhigh"]
export const THINKING_LEVELS = [
  { id: "off", name: "None", icon: "○" },
  { id: "minimal", name: "Low", icon: "◐" },
  { id: "low", name: "Med", icon: "◑" },
  { id: "medium", name: "High", icon: "◒" },
  { id: "high", name: "XHigh", icon: "●" },
] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number]["id"];

export interface UseThinkingSelectorReturn {
  // 状态
  isOpen: boolean;
  currentLevel: ThinkingLevel;
  currentLevelData: (typeof THINKING_LEVELS)[number];
  levels: typeof THINKING_LEVELS;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  selectLevel: (level: ThinkingLevel) => void;
}

interface UseThinkingSelectorOptions {
  currentLevel: ThinkingLevel;
  onLevelChange: (level: ThinkingLevel) => void;
}

export function useThinkingSelector(
  options: UseThinkingSelectorOptions
): UseThinkingSelectorReturn {
  const { currentLevel, onLevelChange } = options;

  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const selectLevel = useCallback(
    (level: ThinkingLevel) => {
      onLevelChange(level);
      close();
    },
    [onLevelChange, close]
  );

  const currentLevelData = THINKING_LEVELS.find((t) => t.id === currentLevel) || THINKING_LEVELS[2];

  return {
    isOpen,
    currentLevel,
    currentLevelData,
    levels: THINKING_LEVELS,
    open,
    close,
    toggle,
    selectLevel,
  };
}
