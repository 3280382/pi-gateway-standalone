/**
 * ModalStore Unit Tests
 * 测试纯函数逻辑
 */

import { beforeEach, describe, expect, it } from "vitest";

// 模拟 ModalStore 状态和操作
interface TestModalState {
  isSystemPromptOpen: boolean;
  isLlmLogOpen: boolean;
  isModelSelectorOpen: boolean;
  isThinkingLevelOpen: boolean;
  isDirectoryBrowserOpen: boolean;
  isFileViewerOpen: boolean;
}

interface TestModalActions {
  openSystemPrompt: () => void;
  closeSystemPrompt: () => void;
  openLlmLog: () => void;
  closeLlmLog: () => void;
  openModelSelector: () => void;
  closeModelSelector: () => void;
  openThinkingLevel: () => void;
  closeThinkingLevel: () => void;
  openDirectoryBrowser: () => void;
  closeDirectoryBrowser: () => void;
  closeAll: () => void;
  getOpenModalCount: () => number;
}

function createTestStore(): TestModalState & TestModalActions {
  const state: TestModalState = {
    isSystemPromptOpen: false,
    isLlmLogOpen: false,
    isModelSelectorOpen: false,
    isThinkingLevelOpen: false,
    isDirectoryBrowserOpen: false,
    isFileViewerOpen: false,
  };

  return {
    ...state,

    openSystemPrompt() {
      this.isSystemPromptOpen = true;
    },

    closeSystemPrompt() {
      this.isSystemPromptOpen = false;
    },

    openLlmLog() {
      this.isLlmLogOpen = true;
    },

    closeLlmLog() {
      this.isLlmLogOpen = false;
    },

    openModelSelector() {
      this.isModelSelectorOpen = true;
    },

    closeModelSelector() {
      this.isModelSelectorOpen = false;
    },

    openThinkingLevel() {
      this.isThinkingLevelOpen = true;
    },

    closeThinkingLevel() {
      this.isThinkingLevelOpen = false;
    },

    openDirectoryBrowser() {
      this.isDirectoryBrowserOpen = true;
    },

    closeDirectoryBrowser() {
      this.isDirectoryBrowserOpen = false;
    },

    closeAll() {
      this.isSystemPromptOpen = false;
      this.isLlmLogOpen = false;
      this.isModelSelectorOpen = false;
      this.isThinkingLevelOpen = false;
      this.isDirectoryBrowserOpen = false;
      this.isFileViewerOpen = false;
    },

    getOpenModalCount(): number {
      let count = 0;
      if (this.isSystemPromptOpen) count++;
      if (this.isLlmLogOpen) count++;
      if (this.isModelSelectorOpen) count++;
      if (this.isThinkingLevelOpen) count++;
      if (this.isDirectoryBrowserOpen) count++;
      if (this.isFileViewerOpen) count++;
      return count;
    },
  };
}

describe("ModalStore", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("Modal Opening", () => {
    it("should open system prompt modal", () => {
      store.openSystemPrompt();
      expect(store.isSystemPromptOpen).toBe(true);
    });

    it("should open LLM log modal", () => {
      store.openLlmLog();
      expect(store.isLlmLogOpen).toBe(true);
    });

    it("should open model selector modal", () => {
      store.openModelSelector();
      expect(store.isModelSelectorOpen).toBe(true);
    });

    it("should open thinking level modal", () => {
      store.openThinkingLevel();
      expect(store.isThinkingLevelOpen).toBe(true);
    });

    it("should open directory browser modal", () => {
      store.openDirectoryBrowser();
      expect(store.isDirectoryBrowserOpen).toBe(true);
    });

    it("should open multiple modals", () => {
      store.openSystemPrompt();
      store.openLlmLog();
      store.openModelSelector();

      expect(store.getOpenModalCount()).toBe(3);
    });
  });

  describe("Modal Closing", () => {
    it("should close system prompt modal", () => {
      store.openSystemPrompt();
      store.closeSystemPrompt();
      expect(store.isSystemPromptOpen).toBe(false);
    });

    it("should close specific modal without affecting others", () => {
      store.openSystemPrompt();
      store.openLlmLog();

      store.closeSystemPrompt();

      expect(store.isSystemPromptOpen).toBe(false);
      expect(store.isLlmLogOpen).toBe(true);
    });

    it("should close all modals", () => {
      store.openSystemPrompt();
      store.openLlmLog();
      store.openModelSelector();
      store.openThinkingLevel();

      store.closeAll();

      expect(store.getOpenModalCount()).toBe(0);
      expect(store.isSystemPromptOpen).toBe(false);
      expect(store.isLlmLogOpen).toBe(false);
      expect(store.isModelSelectorOpen).toBe(false);
      expect(store.isThinkingLevelOpen).toBe(false);
    });
  });

  describe("Empty State", () => {
    it("should have all modals closed by default", () => {
      expect(store.getOpenModalCount()).toBe(0);
      expect(store.isSystemPromptOpen).toBe(false);
      expect(store.isLlmLogOpen).toBe(false);
      expect(store.isModelSelectorOpen).toBe(false);
      expect(store.isThinkingLevelOpen).toBe(false);
      expect(store.isDirectoryBrowserOpen).toBe(false);
      expect(store.isFileViewerOpen).toBe(false);
    });
  });

  describe("Duplicate Operations", () => {
    it("should handle opening same modal twice", () => {
      store.openSystemPrompt();
      store.openSystemPrompt();

      expect(store.isSystemPromptOpen).toBe(true);
      expect(store.getOpenModalCount()).toBe(1);
    });

    it("should handle closing already closed modal", () => {
      expect(() => store.closeSystemPrompt()).not.toThrow();
      expect(store.isSystemPromptOpen).toBe(false);
    });
  });
});

console.log("[Test] ModalStore tests loaded");
