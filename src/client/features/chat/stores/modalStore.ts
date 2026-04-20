/**
 * Modal Store - Modal状态管理
 */

import { create } from "zustand";

export interface ModalState {
  // 系统提示
  isSystemPromptOpen: boolean;
  // LLM logs
  isLlmLogOpen: boolean;
  // 模型选择器
  isModelSelectorOpen: boolean;
  // Thinking level
  isThinkingLevelOpen: boolean;
  // directories浏览器
  isDirectoryBrowserOpen: boolean;
  // Files查看器
  isFileViewerOpen: boolean;
  // Filter面板
  isFilterPanelOpen: boolean;
}

interface ModalActions {
  // 系统提示
  openSystemPrompt: () => void;
  closeSystemPrompt: () => void;
  // LLM logs
  openLlmLog: () => void;
  closeLlmLog: () => void;
  // 模型选择器
  openModelSelector: () => void;
  closeModelSelector: () => void;
  // Thinking level
  openThinkingLevel: () => void;
  closeThinkingLevel: () => void;
  // directories浏览器
  openDirectoryBrowser: () => void;
  closeDirectoryBrowser: () => void;
  // Filter面板
  openFilterPanel: () => void;
  closeFilterPanel: () => void;
  // Close所有
  closeAll: () => void;
}

export const useModalStore = create<ModalState & ModalActions>()((set) => ({
  // Initial state
  isSystemPromptOpen: false,
  isLlmLogOpen: false,
  isModelSelectorOpen: false,
  isThinkingLevelOpen: false,
  isDirectoryBrowserOpen: false,
  isFileViewerOpen: false,
  isFilterPanelOpen: false,

  // 系统提示
  openSystemPrompt: () => set({ isSystemPromptOpen: true }),
  closeSystemPrompt: () => set({ isSystemPromptOpen: false }),

  // LLM logs
  openLlmLog: () => set({ isLlmLogOpen: true }),
  closeLlmLog: () => set({ isLlmLogOpen: false }),

  // 模型选择器
  openModelSelector: () => set({ isModelSelectorOpen: true }),
  closeModelSelector: () => set({ isModelSelectorOpen: false }),

  // Thinking level
  openThinkingLevel: () => set({ isThinkingLevelOpen: true }),
  closeThinkingLevel: () => set({ isThinkingLevelOpen: false }),

  // directories浏览器
  openDirectoryBrowser: () => set({ isDirectoryBrowserOpen: true }),
  closeDirectoryBrowser: () => set({ isDirectoryBrowserOpen: false }),

  // Filter面板
  openFilterPanel: () => set({ isFilterPanelOpen: true }),
  closeFilterPanel: () => set({ isFilterPanelOpen: false }),

  // Close所有
  closeAll: () =>
    set({
      isSystemPromptOpen: false,
      isLlmLogOpen: false,
      isModelSelectorOpen: false,
      isThinkingLevelOpen: false,
      isDirectoryBrowserOpen: false,
      isFileViewerOpen: false,
      isFilterPanelOpen: false,
    }),
}));
