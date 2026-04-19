/**
 * Modal Store - 模态框状态管理
 */

import { create } from "zustand";

export interface ModalState {
  // 系统提示
  isSystemPromptOpen: boolean;
  // LLM日志
  isLlmLogOpen: boolean;
  // 模型选择器
  isModelSelectorOpen: boolean;
  // 思考级别
  isThinkingLevelOpen: boolean;
  // 目录浏览器
  isDirectoryBrowserOpen: boolean;
  // Files查看器
  isFileViewerOpen: boolean;
  // 过滤器面板
  isFilterPanelOpen: boolean;
}

interface ModalActions {
  // 系统提示
  openSystemPrompt: () => void;
  closeSystemPrompt: () => void;
  // LLM日志
  openLlmLog: () => void;
  closeLlmLog: () => void;
  // 模型选择器
  openModelSelector: () => void;
  closeModelSelector: () => void;
  // 思考级别
  openThinkingLevel: () => void;
  closeThinkingLevel: () => void;
  // 目录浏览器
  openDirectoryBrowser: () => void;
  closeDirectoryBrowser: () => void;
  // 过滤器面板
  openFilterPanel: () => void;
  closeFilterPanel: () => void;
  // 关闭所有
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

  // LLM日志
  openLlmLog: () => set({ isLlmLogOpen: true }),
  closeLlmLog: () => set({ isLlmLogOpen: false }),

  // 模型选择器
  openModelSelector: () => set({ isModelSelectorOpen: true }),
  closeModelSelector: () => set({ isModelSelectorOpen: false }),

  // 思考级别
  openThinkingLevel: () => set({ isThinkingLevelOpen: true }),
  closeThinkingLevel: () => set({ isThinkingLevelOpen: false }),

  // 目录浏览器
  openDirectoryBrowser: () => set({ isDirectoryBrowserOpen: true }),
  closeDirectoryBrowser: () => set({ isDirectoryBrowserOpen: false }),

  // 过滤器面板
  openFilterPanel: () => set({ isFilterPanelOpen: true }),
  closeFilterPanel: () => set({ isFilterPanelOpen: false }),

  // 关闭所有
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
