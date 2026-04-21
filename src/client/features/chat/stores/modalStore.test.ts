/**
 * Modal Store Tests
 * Tests for modalStore state management
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TestLogger, TestReporter } from "../../../../../test/lib/test-utils";

const logger = new TestLogger("modal-store");
const reporter = new TestReporter("modal-store");

describe("Modal Store", () => {
  beforeEach(() => {
    logger.info("Resetting test state");
  });

  it("initializes with all modals closed", async () => {
    await reporter.runTest("all modals closed on init", async () => {
      const { useModalStore } = await import("./modalStore");
      const state = useModalStore.getState();

      expect(state.isSystemPromptOpen).toBe(false);
      expect(state.isLlmLogOpen).toBe(false);
      expect(state.isModelSelectorOpen).toBe(false);
      expect(state.isThinkingLevelOpen).toBe(false);
      expect(state.isDirectoryBrowserOpen).toBe(false);
      expect(state.isFileViewerOpen).toBe(false);
      expect(state.isFilterPanelOpen).toBe(false);
      expect(state.isTemplateModalOpen).toBe(false);
      logger.info("All modals initialized as closed");
    });
  });

  it("can open and close system prompt modal", async () => {
    await reporter.runTest("system prompt modal", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      store.openSystemPrompt();
      expect(useModalStore.getState().isSystemPromptOpen).toBe(true);

      store.closeSystemPrompt();
      expect(useModalStore.getState().isSystemPromptOpen).toBe(false);
      logger.info("System prompt modal works correctly");
    });
  });

  it("can open and close LLM log modal", async () => {
    await reporter.runTest("LLM log modal", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      store.openLlmLog();
      expect(useModalStore.getState().isLlmLogOpen).toBe(true);

      store.closeLlmLog();
      expect(useModalStore.getState().isLlmLogOpen).toBe(false);
      logger.info("LLM log modal works correctly");
    });
  });

  it("can open and close model selector modal", async () => {
    await reporter.runTest("model selector modal", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      store.openModelSelector();
      expect(useModalStore.getState().isModelSelectorOpen).toBe(true);

      store.closeModelSelector();
      expect(useModalStore.getState().isModelSelectorOpen).toBe(false);
      logger.info("Model selector modal works correctly");
    });
  });

  it("can open and close thinking level modal", async () => {
    await reporter.runTest("thinking level modal", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      store.openThinkingLevel();
      expect(useModalStore.getState().isThinkingLevelOpen).toBe(true);

      store.closeThinkingLevel();
      expect(useModalStore.getState().isThinkingLevelOpen).toBe(false);
      logger.info("Thinking level modal works correctly");
    });
  });

  it("can open and close directory browser modal", async () => {
    await reporter.runTest("directory browser modal", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      store.openDirectoryBrowser();
      expect(useModalStore.getState().isDirectoryBrowserOpen).toBe(true);

      store.closeDirectoryBrowser();
      expect(useModalStore.getState().isDirectoryBrowserOpen).toBe(false);
      logger.info("Directory browser modal works correctly");
    });
  });

  it("can open and close filter panel", async () => {
    await reporter.runTest("filter panel", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      store.openFilterPanel();
      expect(useModalStore.getState().isFilterPanelOpen).toBe(true);

      store.closeFilterPanel();
      expect(useModalStore.getState().isFilterPanelOpen).toBe(false);
      logger.info("Filter panel works correctly");
    });
  });

  it("can open and close template modal", async () => {
    await reporter.runTest("template modal", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      store.openTemplateModal();
      expect(useModalStore.getState().isTemplateModalOpen).toBe(true);

      store.closeTemplateModal();
      expect(useModalStore.getState().isTemplateModalOpen).toBe(false);
      logger.info("Template modal works correctly");
    });
  });

  it("can close all modals at once", async () => {
    await reporter.runTest("close all modals", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      // Open several modals
      store.openSystemPrompt();
      store.openLlmLog();
      store.openModelSelector();
      store.openThinkingLevel();

      // Verify they're open
      expect(useModalStore.getState().isSystemPromptOpen).toBe(true);
      expect(useModalStore.getState().isLlmLogOpen).toBe(true);
      expect(useModalStore.getState().isModelSelectorOpen).toBe(true);
      expect(useModalStore.getState().isThinkingLevelOpen).toBe(true);

      // Close all
      store.closeAll();

      // Verify all are closed
      expect(useModalStore.getState().isSystemPromptOpen).toBe(false);
      expect(useModalStore.getState().isLlmLogOpen).toBe(false);
      expect(useModalStore.getState().isModelSelectorOpen).toBe(false);
      expect(useModalStore.getState().isThinkingLevelOpen).toBe(false);
      expect(useModalStore.getState().isDirectoryBrowserOpen).toBe(false);
      expect(useModalStore.getState().isFilterPanelOpen).toBe(false);
      expect(useModalStore.getState().isTemplateModalOpen).toBe(false);

      logger.info("All modals closed successfully");
    });
  });

  it("modals operate independently", async () => {
    await reporter.runTest("independent modal operations", async () => {
      const { useModalStore } = await import("./modalStore");
      const store = useModalStore.getState();

      // Open first modal
      store.openSystemPrompt();
      expect(useModalStore.getState().isSystemPromptOpen).toBe(true);
      expect(useModalStore.getState().isLlmLogOpen).toBe(false);

      // Open second modal
      store.openLlmLog();
      expect(useModalStore.getState().isSystemPromptOpen).toBe(true);
      expect(useModalStore.getState().isLlmLogOpen).toBe(true);

      // Close first modal
      store.closeSystemPrompt();
      expect(useModalStore.getState().isSystemPromptOpen).toBe(false);
      expect(useModalStore.getState().isLlmLogOpen).toBe(true);

      logger.info("Modals operate independently");
    });
  });
});

console.log("[Test] Modal Store tests loaded");
